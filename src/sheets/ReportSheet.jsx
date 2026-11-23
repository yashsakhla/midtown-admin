import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { list } from '../api/mappers';
import DateRange from '../components/DateRange';
import { Kpi, KpiGrid } from '../components/Kpi';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import { addDays, fmtDate, money } from '../lib/format';
import { downloadExcel, printReport } from '../lib/print';
import { useHotel } from '../store/HotelContext';

const PAGE_SIZE = 25;
const CATEGORIES = [['ALL', 'All'], ['ROOM', 'Room'], ['FOOD', 'Food'], ['EXPENSE', 'Expense'], ['OTHER', 'Other']];
const num = (v) => Number(v) || 0;

/** Quick ranges, resolved against the business day (not the clock) so they match the day book. */
const monthStart = (d) => d.slice(0, 8) + '01';
const PRESETS = [
  ['today', 'Today', (t) => [t, t]],
  ['yesterday', 'Yesterday', (t) => [addDays(t, -1), addDays(t, -1)]],
  ['7d', 'Last 7 days', (t) => [addDays(t, -6), t]],
  ['30d', 'Last 30 days', (t) => [addDays(t, -29), t]],
  ['month', 'This month', (t) => [monthStart(t), t]],
  ['lastmonth', 'Last month', (t) => {
    const end = addDays(monthStart(t), -1);
    return [monthStart(end), end];
  }]
];

const mapSummary = (d) => {
  const s = d?.data ?? d ?? {};
  return {
    sales: num(s.totalSales), guests: num(s.totalGuests),
    food: num(s.totalFoodOrders), expenses: num(s.totalExpenses),
    foodSales: s.foodSales == null ? null : num(s.foodSales)
  };
};

const mapRow = (e) => ({
  id: e.id,
  date: String(e.businessDate || e.date || '').slice(0, 10),
  time: String(e.time || '').slice(0, 5),
  room: String(e.roomNumber ?? e.room ?? ''),
  guest: e.guestName ?? e.guest ?? '',
  type: e.type ?? '',
  mode: e.mode ?? '',
  dc: String(e.dc ?? '').toLowerCase().startsWith('d') ? 'debit' : 'credit',
  amount: num(e.amount),
  narration: e.narration ?? ''
});

export function ExportSheet() {
  const { db, toast, isAdmin } = useHotel();
  const anchor = db.day?.businessDate || db.date;

  const [preset, setPreset] = useState('today');
  const [range, setRange] = useState([anchor, anchor]);
  const [category, setCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, credit: 0, debit: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // A manager only ever sees the open business day.
  const [from, to] = isAdmin ? range : [anchor, anchor];

  const pick = (key, fn) => { setPreset(key); setRange(fn(anchor)); setPage(1); };
  const pickRange = (a, b) => { setPreset('custom'); setRange([a, b]); setPage(1); };
  const custom = (i) => (e) => {
    const v = e.target.value;
    if (!v) return;
    setPreset('custom');
    setPage(1);
    setRange((r) => {
      const next = [...r];
      next[i] = v;
      if (next[0] > next[1]) next[1 - i] = v;          // keep from <= to
      return next;
    });
  };

  const query = useCallback((extra = {}) => ({ from, to, category: category === 'ALL' ? '' : category, ...extra }), [from, to, category]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/reports/summary', { from, to }),
      api.get('/reports/entries', query({ page, limit: PAGE_SIZE }))
    ]).then(([s, r]) => {
      if (!live) return;
      setSummary(mapSummary(s));
      setRows(list(r).map(mapRow));
      setMeta({ total: num(r?.total ?? r?.meta?.total), credit: num(r?.totals?.credit), debit: num(r?.totals?.debit) });
    }).catch((e) => {
      if (!live) return;
      setError(e.status === 403 ? 'You can only view the current open day.' : e.message || 'Could not load the report');
      setSummary(null);
      setRows([]);
    }).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [from, to, category, page, query]);

  const pages = Math.max(1, Math.ceil(meta.total / PAGE_SIZE));
  const label = from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;

  /** Exports the whole range (not just the visible page). */
  const exportAll = async (kind) => {
    try {
      const r = await api.get('/reports/entries', query({ page: 1, limit: 5000 }));
      const all = list(r).map(mapRow);
      const out = {
        title: 'Entries report', date: from === to ? from : `${from} to ${to}`,
        head: ['Date', 'Time', 'Room', 'Guest', 'Type', 'Mode', 'Narration', 'Credit', 'Debit'],
        rows: all.map((x) => [x.date, x.time, x.room, x.guest, x.type, x.mode, x.narration,
          x.dc === 'credit' ? x.amount : '', x.dc === 'debit' ? x.amount : '']),
        summary: summary
          ? `Sales ${money(summary.sales)} · Guests ${summary.guests} · Food orders ${summary.food} · Expenses ${money(summary.expenses)}`
          : ''
      };
      if (kind === 'pdf') printReport(out); else downloadExcel(out);
    } catch (e) {
      toast(e.message || 'Export failed');
    }
  };

  const footer = useMemo(() => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="btn p" disabled={!rows.length} onClick={() => exportAll('pdf')}>Download as PDF</button>
      <button className="btn" disabled={!rows.length} onClick={() => exportAll('xls')}>Download as Excel</button>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [rows.length, from, to, category, summary]);

  return (
    <Sheet title="Reports" footer={footer}>
      {isAdmin ? (
        <>
          <div className="chips">
            {PRESETS.map(([key, text, fn]) => (
              <button key={key} type="button" className={preset === key ? 'on' : ''} onClick={() => pick(key, fn)}>{text}</button>
            ))}
            <button type="button" className={preset === 'custom' ? 'on' : ''} onClick={() => setPreset('custom')}>Custom</button>
          </div>
          <DateRange from={from} to={to} max={anchor} onChange={pickRange} />
          <div className="rpt-range">
            <label>From<input type="date" value={from} max={to} onChange={custom(0)} /></label>
            <label>To<input type="date" value={to} min={from} onChange={custom(1)} /></label>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 10px' }}>
          Showing the current open day only.
        </p>
      )}

      <div className="rpt-label">{label}{loading && <Pill tone="n">Loading…</Pill>}</div>
      {error && <div className="bk-alert" role="alert">{error}</div>}

      <KpiGrid>
        <Kpi icon="bank" tone="green" value={money(summary?.sales)} label="Total sales" note="room + food + other" />
        <Kpi icon="down" tone="blue" value={summary ? summary.guests : '—'} label="Total guests" note="checked in" />
        <Kpi icon="wallet" tone="orange" value={summary ? summary.food : '—'} label="Total food orders"
          note={summary?.foodSales != null ? money(summary.foodSales) : undefined} />
        <Kpi icon="up" tone="red" value={money(summary?.expenses)} label="Total expenses" />
      </KpiGrid>

      <div className="chips" style={{ marginTop: 6 }}>
        {CATEGORIES.map(([key, text]) => (
          <button key={key} type="button" className={category === key ? 'on' : ''}
            onClick={() => { setCategory(key); setPage(1); }}>{text}</button>
        ))}
      </div>

      <div className="rpt-wrap">
        <table className="rpt">
          <thead>
            <tr>
              <th>Date</th><th>Time</th><th>Room</th><th>Guest</th><th>Type</th><th>Mode</th><th>Narration</th>
              <th className="rt">Credit</th><th className="rt">Debit</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((x) => (
              <tr key={x.id}>
                <td>{fmtDate(x.date)}</td>
                <td>{x.time || '—'}</td>
                <td>{x.room || '—'}</td>
                <td>{x.guest || '—'}</td>
                <td>{x.type}</td>
                <td>{x.mode}</td>
                <td className="nar">{x.narration}</td>
                <td className="rt num cr">{x.dc === 'credit' ? money(x.amount) : ''}</td>
                <td className="rt num dr">{x.dc === 'debit' ? money(x.amount) : ''}</td>
              </tr>
            )) : (
              <tr><td colSpan={9} className="empty">{loading ? 'Loading…' : 'No entries in this range.'}</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={7}>All {meta.total} entries in range</td>
                <td className="rt num">{money(meta.credit)}</td>
                <td className="rt num">{money(meta.debit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {pages > 1 && (
        <div className="rpt-pager">
          <button className="btn sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>&#8249; Prev</button>
          <span>Page {page} of {pages}</span>
          <button className="btn sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next &#8250;</button>
        </div>
      )}
    </Sheet>
  );
}
