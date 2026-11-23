import { useState } from 'react';
import Field, { Row2 } from '../components/Field';
import { Kpi, KpiGrid } from '../components/Kpi';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import { addDays, fmtDate, money } from '../lib/format';
import {
  EXPRESS_PCT, isLaundryRequest, LAUNDRY_ACTION, LAUNDRY_ITEMS, LAUNDRY_NEXT, LAUNDRY_SERVICES, LAUNDRY_TONE,
  laundryRate, laundryTotals, serviceLabel
} from '../lib/laundry';
import { printSlip } from '../lib/print';
import { PAYMENT_MODES } from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

const FILTERS = [['open', 'Open'], ['Requested', 'To pick up'], ['Picked up', 'Picked up'], ['In process', 'In process'],
  ['Ready', 'Ready'], ['Delivered', 'Delivered'], ['Cancelled', 'Cancelled'], ['all', 'All']];

const summary = (o) => o.items.map((i) => `${i.q}× ${i.n}`).join(', ');

/* ------------------------------------------------------------ laundry page */

export function LaundrySheet() {
  const { db, openSheet, actions } = useHotel();
  const [filter, setFilter] = useState('open');

  const orders = db.laundry || [];
  const live = orders.filter((o) => o.status !== 'Cancelled');
  const count = (s) => orders.filter((o) => o.status === s).length;
  const revenue = live.filter((o) => o.date === db.date || !o.date).reduce((t, o) => t + o.amount, 0);

  const shown = orders.filter((o) => (filter === 'all' ? true
    : filter === 'open' ? !['Delivered', 'Cancelled'].includes(o.status) : o.status === filter));

  // Guest requests from rooms that have no laundry order yet.
  const linked = new Set(orders.filter((o) => o.status !== 'Cancelled').map((o) => String(o.requestId)));
  const requests = (db.requests || []).filter((r) =>
    isLaundryRequest(r) && ['SENT', 'IN_PROGRESS'].includes(r.status) && !r.expired && !linked.has(String(r.id)));

  const cancel = (o) => {
    if (window.confirm(`Cancel laundry order ${o.no || ''} for ${o.room ? `room ${o.room}` : o.guest}?`)) actions.updateLaundryStatus(o.id, 'Cancelled');
  };
  const slip = (o) => printSlip({
    title: 'LAUNDRY SLIP', who: o.room ? `Room ${o.room} · ${o.guest}` : o.guest || 'Walk-in',
    items: o.items.map((i) => ({ n: `${i.n} (${serviceLabel(i.service)})`, q: i.q, p: i.p })),
    note: `${o.no ? `Order ${o.no} · ` : ''}${o.express ? 'EXPRESS · ' : ''}${o.expected ? `Deliver by ${fmtDate(o.expected)}` : ''}`
  });

  return (
    <Sheet
      title="Laundry"
      footer={<button className="btn p" onClick={() => openSheet('laundryOrder')}>+ New laundry order</button>}
    >
      <KpiGrid>
        <Kpi icon="calendar" tone="orange" value={count('Requested')} label="To pick up" />
        <Kpi icon="food" tone="blue" value={count('Picked up') + count('In process')} label="In process" />
        <Kpi icon="check" tone="green" value={count('Ready')} label="Ready to deliver" />
        <Kpi icon="bank" tone="gold" value={money(revenue)} label="Laundry value today" note="excl. cancelled" />
      </KpiGrid>

      {requests.length > 0 && (
        <>
          <h3 style={{ margin: '4px 0 8px', fontSize: 14 }}>Room requests · {requests.length}</h3>
          {requests.map((r) => (
            <ListRow
              key={r.id}
              title={`Room ${r.room || '—'} · ${r.guest || 'Guest'}`}
              sub={`${r.note || 'Laundry pickup requested'}${r.date ? ` · ${fmtDate(r.date)}` : ''}`}
              right={
                <button className="btn sm" onClick={() => openSheet('laundryOrder', { room: r.room, requestId: r.id, note: r.note })}>
                  Create order
                </button>
              }
            />
          ))}
          <div style={{ height: 8 }} />
        </>
      )}

      <div className="chips">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {l}{k === 'all' ? ` ${orders.length}` : k === 'open' ? ` ${orders.filter((o) => !['Delivered', 'Cancelled'].includes(o.status)).length}` : ` ${count(k)}`}
          </button>
        ))}
      </div>

      <div className="rpt-wrap bk-table">
        <table className="rpt">
          <thead>
            <tr><th>Order</th><th>Room / guest</th><th>Items</th><th className="rt">Amount</th><th>Status</th><th className="rt">Actions</th></tr>
          </thead>
          <tbody>
            {shown.length ? shown.map((o) => {
              const next = LAUNDRY_NEXT[o.status];
              return (
                <tr key={o.id}>
                  <td className="room"><b>{o.no || '—'}</b><span>{o.time || ''}</span></td>
                  <td className="guest">
                    <b>{o.room ? `Room ${o.room}` : 'Walk-in'}{o.express && <Pill tone="o"> Express</Pill>}</b>
                    <span>{o.guest || '—'}{o.phone ? ` · ${o.phone}` : ''}{o.source === 'ROOM_REQUEST' ? ' · guest request' : ''}</span>
                  </td>
                  <td className="nar">{summary(o)}{o.expected && <span className="sub">Deliver by {fmtDate(o.expected)}</span>}</td>
                  <td className="rt num amt">{money(o.amount)}<span className="sub">{o.billTo === 'ROOM' ? 'to room' : o.billTo ? 'pay on delivery' : ''}</span></td>
                  <td><Pill tone={LAUNDRY_TONE[o.status] || 'n'}>{o.status}</Pill></td>
                  <td className="rt acts">
                    {next && <button className="btn sm p" onClick={() => actions.updateLaundryStatus(o.id, next)}>{LAUNDRY_ACTION[next]}</button>}
                    {o.status !== 'Cancelled' && <button className="btn sm" onClick={() => slip(o)}>Print</button>}
                    {next && <button className="btn sm del" onClick={() => cancel(o)}>Cancel</button>}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} className="empty">No laundry orders in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '10px 0 0' }}>
        Move an order along: To pick up → Picked up → In process → Ready → Delivered. Room orders are charged to the guest's folio when delivered; walk-in orders are paid on delivery.
      </p>
    </Sheet>
  );
}

/* ------------------------------------------------------------ new order */

const newLine = () => ({ item: LAUNDRY_ITEMS[0].n, service: 'WASH', q: '1', p: String(laundryRate(LAUNDRY_ITEMS[0].n, 'WASH')) });

export function LaundryOrderSheet({ room: presetRoom = '', requestId = null, note = '' }) {
  const { db, actions } = useHotel();
  const occupied = db.rooms.filter((r) => r.status === 'occupied');
  const start = occupied.find((r) => r.no === presetRoom) || (presetRoom ? null : occupied[0]);
  const [form, setForm] = useState({
    source: presetRoom || occupied.length ? 'ROOM' : 'WALK_IN',
    room: start?.no || '', guest: start?.guest || '', phone: start?.phone || '',
    express: false, expected: addDays(db.date, 1), billTo: 'ROOM', mode: 'Cash', note: note || '', requestId
  });
  const [lines, setLines] = useState([newLine()]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isRoom = form.source === 'ROOM';

  const setSource = (e) => {
    const source = e.target.value;
    setForm((f) => ({ ...f, source, billTo: source === 'ROOM' ? 'ROOM' : 'PAY_NOW' }));
  };
  const pickRoom = (e) => {
    const r = db.rooms.find((x) => x.no === e.target.value);
    setForm((f) => ({ ...f, room: e.target.value, guest: r?.guest || '', phone: r?.phone || '' }));
  };
  const setExpress = (e) => {
    const express = e.target.checked;
    setForm((f) => ({ ...f, express, expected: addDays(db.date, express ? 0 : 1) }));
  };
  const setLine = (i, patch) => setLines((ls) => ls.map((l, x) => {
    if (x !== i) return l;
    const next = { ...l, ...patch };
    if ('item' in patch || 'service' in patch) next.p = String(laundryRate(next.item, next.service));
    return next;
  }));

  const { sub, extra, total } = laundryTotals(lines, form.express);

  return (
    <Sheet
      title="New laundry order"
      footer={<button className="btn p" onClick={() => actions.addLaundryOrder({ ...form, lines })}>Create order · {money(total)}</button>}
    >
      {requestId && (
        <div style={{ background: 'var(--wash)', color: 'var(--blue)', borderRadius: 11, padding: '10px 12px', fontSize: 12.5, marginBottom: 10 }}>
          Created from the guest's room request. The request moves to In progress, and to Completed on delivery.
        </div>
      )}
      <Row2>
        <Field as="select" label="Order for" value={form.source} onChange={setSource} disabled={!!requestId}>
          <option value="ROOM">Room guest (in house)</option>
          <option value="WALK_IN">Walk-in / outside guest</option>
        </Field>
        {isRoom ? (
          <Field as="select" label="Room" value={form.room} onChange={pickRoom} disabled={!!requestId}>
            {occupied.length ? occupied.map((r) => <option key={r.no} value={r.no}>{r.no} · {r.guest}</option>) : <option value="">No occupied room</option>}
          </Field>
        ) : (
          <Field label="Guest name" value={form.guest} onChange={set('guest')} />
        )}
      </Row2>
      {!isRoom && <Field label="Phone" type="tel" value={form.phone} onChange={set('phone')} />}

      <h3 style={{ margin: '6px 0 8px', fontSize: 14 }}>Clothes</h3>
      {lines.map((l, i) => (
        <div key={i} className="lnd-line">
          <select aria-label="Item" value={l.item} onChange={(e) => setLine(i, { item: e.target.value })}>
            {LAUNDRY_ITEMS.map((x) => <option key={x.n}>{x.n}</option>)}
          </select>
          <select aria-label="Service" value={l.service} onChange={(e) => setLine(i, { service: e.target.value })}>
            {LAUNDRY_SERVICES.map(([c, t]) => <option key={c} value={c}>{t}</option>)}
          </select>
          <input type="number" aria-label="Quantity" value={l.q} onChange={(e) => setLine(i, { q: e.target.value })} />
          <input type="number" aria-label="Rate per piece" value={l.p} onChange={(e) => setLine(i, { p: e.target.value })} />
          <button type="button" className="btn sm" aria-label="Remove" disabled={lines.length === 1}
            onClick={() => setLines((ls) => ls.filter((_, x) => x !== i))}>✕</button>
        </div>
      ))}
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 6px' }}>Item · service · quantity · rate per piece (you can change the rate)</p>
      <button type="button" className="btn sm" style={{ marginBottom: 12 }} onClick={() => setLines((ls) => [...ls, newLine()])}>+ Add clothes</button>

      <Row2>
        <Field label="Deliver by" type="date" value={form.expected} onChange={set('expected')} />
        <div className="f">
          <label>Express service</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, padding: '10px 0', color: 'var(--ink)', fontWeight: 500 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.express} onChange={setExpress} />
            Same day · +{EXPRESS_PCT}%
          </label>
        </div>
      </Row2>
      <Row2>
        <Field as="select" label="Billing" value={form.billTo} onChange={set('billTo')}>
          {isRoom && <option value="ROOM">Charge to room folio</option>}
          <option value="PAY_NOW">Pay on delivery</option>
        </Field>
        {form.billTo === 'PAY_NOW' && (
          <Field as="select" label="Payment mode" value={form.mode} onChange={set('mode')}>
            {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
          </Field>
        )}
      </Row2>
      <Field label="Note" placeholder="Stains, special care, pickup time…" value={form.note} onChange={set('note')} />

      <table>
        <tbody>
          <tr><td>Clothes total</td><td className="rt num">{money(sub)}</td></tr>
          {form.express && <tr><td>Express charge {EXPRESS_PCT}%</td><td className="rt num">{money(extra)}</td></tr>}
          <tr><td><b>Order total</b></td><td className="rt num" style={{ fontSize: 16, color: 'var(--ink)' }}>{money(total)}</td></tr>
        </tbody>
      </table>
      <div style={{ height: 12 }} />
    </Sheet>
  );
}
