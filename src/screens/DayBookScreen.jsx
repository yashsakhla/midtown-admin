import Card from '../components/Card';
import { Kpi, KpiGrid } from '../components/Kpi';
import ListRow from '../components/ListRow';
import { money } from '../lib/format';
import { printReport } from '../lib/print';
import { buildReport } from '../lib/reports';
import {
  byMode, closingBalance, PAYMENT_MODES, totalPayout, totalReceipt
} from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

export default function DayBookScreen() {
  const { db, openSheet } = useHotel();

  const maxMode = Math.max(...PAYMENT_MODES.map((m) => byMode(db, m)), 1);
  const otherLines = db.cash.txns.filter((t) => t.head === 'Refund' || t.head === 'Other receipt');

  const printDay = () => {
    const { title, head, rows } = buildReport(db, 'daily');
    printReport({
      title, date: db.date, head, rows,
      summary: `Opening ${money(db.cash.opening)} · Receipt ${money(totalReceipt(db))} · ` +
               `Payout ${money(totalPayout(db))} · Closing ${money(closingBalance(db))}`
    });
  };

  return (
    <>
      <KpiGrid>
        <Kpi value={money(db.cash.opening)} label="Opening balance" />
        <Kpi value={money(totalReceipt(db))} label="Total receipt" />
        <Kpi value={money(totalPayout(db))} label="Total payout" />
        <Kpi value={money(closingBalance(db))} label="Closing balance" />
      </KpiGrid>

      <Card title="Collection by mode" body>
        {PAYMENT_MODES.map((m) => {
          const v = byMode(db, m);
          return (
            <div key={m} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span>{m}</span>
                <span className="num" style={{ color: 'var(--ink)' }}>{money(v)}</span>
              </div>
              <div className="bar"><i style={{ width: `${Math.max((v / maxMode) * 100, 2)}%` }} /></div>
            </div>
          );
        })}
        <button className="btn sm" onClick={() => openSheet('openingBalance')}>Set opening balance</button>
      </Card>

      <Card
        title="Day register"
        action={<button className="btn sm" onClick={printDay}>Print</button>}
      >
        {db.entries.length ? db.entries.map((e) => (
          <ListRow key={e.id} onClick={() => openSheet('entryView', { id: e.id })}>
            <div style={{ width: 44, textAlign: 'center' }}>
              <div className="num" style={{ color: 'var(--ink)' }}>{e.room || '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{e.time}</div>
            </div>
            <div className="t">
              <b>{e.guest || '—'}</b>
              <span>{e.type} · {e.mode} · {e.narration || ''}</span>
            </div>
            <div className="num" style={{ color: e.dc === 'credit' ? 'var(--green)' : 'var(--red)' }}>
              {e.dc === 'debit' ? '−' : ''}{money(e.amount)}
            </div>
          </ListRow>
        )) : (
          <ListRow><span style={{ color: 'var(--muted)' }}>No entries yet today.</span></ListRow>
        )}
      </Card>

      <Card title="Refunds & other receipts">
        {otherLines.length ? otherLines.map((t, i) => (
          <ListRow
            key={t.id || i}
            title={t.head}
            sub={`${t.mode} · ${t.narration}`}
            right={
              <span className="num" style={{ color: t.dc === 'credit' ? 'var(--green)' : 'var(--red)' }}>
                {t.dc === 'debit' ? '−' : ''}{money(t.amount)}
              </span>
            }
          />
        )) : (
          <ListRow><span style={{ color: 'var(--muted)' }}>Nothing recorded.</span></ListRow>
        )}
      </Card>

      <button className="btn" onClick={() => openSheet('closeDay')}>
        Close day &amp; carry balance forward
      </button>
    </>
  );
}
