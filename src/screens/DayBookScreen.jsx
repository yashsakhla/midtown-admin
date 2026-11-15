import Card from '../components/Card';
import DateBar from '../components/DateBar';
import { Kpi, KpiGrid } from '../components/Kpi';
import ListRow from '../components/ListRow';
import Pill from '../components/Pill';
import { sourceLabel } from '../api/mappers';
import { fmtClock, fmtDate, money } from '../lib/format';
import { printReport } from '../lib/print';
import { buildReport } from '../lib/reports';
import {
  byMode, cashInHand, closingBalance, PAYMENT_MODES, totalPayout, totalReceipt
} from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

/** Which business day is being calculated, who started it and when. */
function DayStatus({ db, openSheet }) {
  const day = db.day;
  const isOpenDay = day?.status === 'OPEN';
  const viewingOpen = isOpenDay && day.businessDate === db.date;
  const c = db.cash;

  let pill = ['n', '—'];
  let main = 'Day status unavailable';
  let sub = '';
  if (day && viewingOpen) {
    pill = ['g', 'Day open'];
    main = `Calculating for ${fmtDate(day.businessDate)}`;
    sub = `Started ${fmtClock(day.openedAt) || '—'}${day.openedBy ? ` by ${day.openedBy}` : ''} · opening ${money(day.openingBalance)}`;
  } else if (c.closed) {
    pill = ['n', 'Closed'];
    main = `${fmtDate(db.date)} is closed`;
    sub = `Started ${fmtClock(c.startedAt) || '—'}${c.startedBy ? ` by ${c.startedBy}` : ''} · closed ${fmtClock(c.closedAt) || '—'}${c.closedBy ? ` by ${c.closedBy}` : ''}`;
  } else if (day) {
    pill = ['o', 'Not run'];
    main = `No day was run on ${fmtDate(db.date)}`;
  }
  if (isOpenDay && !viewingOpen) sub = `${sub ? sub + ' · ' : ''}Read only — new money posts to ${fmtDate(day.businessDate)}`;

  return (
    <div className="bk-status">
      <Pill tone={pill[0]}>{pill[1]}</Pill>
      <div className="txt">
        <b style={{ color: 'var(--ink)' }}>{main}</b>
        {sub && <small>{sub}</small>}
        {!isOpenDay && <small style={{ color: '#A55A00' }}>No day is open — start one to record check-ins, bills and expenses.</small>}
      </div>
      {!isOpenDay && <button className="btn p sm" onClick={() => openSheet('startDay')}>Start day</button>}
    </div>
  );
}

export default function DayBookScreen() {
  const { db, openSheet } = useHotel();

  const maxMode = Math.max(...PAYMENT_MODES.map((m) => byMode(db, m)), 1);
  const openDay = db.day?.status === 'OPEN';
  const viewingOpen = openDay && db.day.businessDate === db.date;
  const short = db.cash.shortage > 0 ? db.cash.shortage : 0;
  const over = db.cash.shortage < 0 ? -db.cash.shortage : 0;

  const printDay = () => {
    const { title, head, rows } = buildReport(db, 'daily');
    printReport({
      title, date: db.date, head, rows,
      summary: `Opening ${money(db.cash.opening)} · Receipt ${money(totalReceipt(db))} · ` +
               `Payout ${money(totalPayout(db))} · Closing ${money(closingBalance(db))}` +
               (short ? ` · SHORTAGE ${money(short)}` : '')
    });
  };

  const openLine = (e) => {
    if (e.kind === 'expense') openSheet('expenses');
    else if (e.kind === 'entry' && !String(e.id).startsWith('oth-')) openSheet('entryView', { id: e.id });
  };

  return (
    <>
      <Card body>
        <div className="bk-top">
          <DateBar label="Day book date" />
          <DayStatus db={db} openSheet={openSheet} />
        </div>
      </Card>

      <KpiGrid>
        <Kpi icon="bank" tone="orange" value={money(db.cash.opening)} label="Opening balance" />
        <Kpi icon="down" tone="blue" value={money(totalReceipt(db))} label="Total receipt" note="all modes" />
        <Kpi icon="up" tone="red" value={money(totalPayout(db))} label="Total payout" note="incl. expenses" />
        <Kpi icon="wallet" tone="gold" value={money(cashInHand(db))} label="Cash in hand" note="expected in drawer" />
        <Kpi icon="check" tone="green" value={money(closingBalance(db))} label="Closing balance" />
      </KpiGrid>

      {(short > 0 || over > 0) && (
        <div className="bk-alert">
          <b>{short > 0 ? `Cash shortage ${money(short)}` : `Cash excess ${money(over)}`}</b>
          {db.cash.counted != null && <> · counted {money(db.cash.counted)} against expected {money(db.cash.expectedCash ?? cashInHand(db))}</>}
          {db.cash.note && <small>Note: {db.cash.note}</small>}
        </div>
      )}

      <div className="bk-main">
        <Card
          title={`Day register · ${fmtDate(db.date)}`}
          action={<button className="btn sm" onClick={printDay}>Print</button>}
        >
          {db.register.length ? db.register.map((e) => {
            const auto = e.source && e.source !== 'MANUAL';
            return (
              <ListRow key={e.id} onClick={() => openLine(e)} className={e.shortfall > 0 ? 'red' : ''}>
                <div style={{ width: 44, textAlign: 'center' }}>
                  <div className="num" style={{ color: 'var(--ink)' }}>{e.room || '—'}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{e.time}</div>
                </div>
                <div className="t">
                  <b>{e.guest || e.type}</b>
                  <span>
                    {e.type} · {e.mode}{e.narration ? ` · ${e.narration}` : ''}
                    {auto && <> · <em style={{ fontStyle: 'normal', color: 'var(--blue)' }}>{sourceLabel(e.source)}</em></>}
                  </span>
                  {e.shortfall > 0 && <span style={{ color: 'var(--red)', fontWeight: 600 }}>Short received {money(e.shortfall)}</span>}
                </div>
                <div className="num" style={{ color: e.dc === 'credit' ? 'var(--green)' : 'var(--red)' }}>
                  {e.dc === 'debit' ? '−' : ''}{money(e.amount)}
                </div>
              </ListRow>
            );
          }) : (
            <ListRow><span style={{ color: 'var(--muted)' }}>No entries on this date.</span></ListRow>
          )}
          {short > 0 && (
            <ListRow className="red">
              <div className="t"><b style={{ color: 'var(--red)' }}>Cash shortage at close</b><span>Counted less than expected</span></div>
              <div className="num" style={{ color: 'var(--red)' }}>{money(short)}</div>
            </ListRow>
          )}
        </Card>

        <div className="bk-side">
          <Card title="Collection by mode" body>
            {PAYMENT_MODES.map((m) => {
              const v = byMode(db, m);
              return (
                <div key={m} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span>{m}</span>
                    <span className="num" style={{ color: 'var(--ink)' }}>{money(v)}</span>
                  </div>
                  <div className="bar"><i style={{ width: `${Math.max((Math.max(v, 0) / maxMode) * 100, 2)}%` }} /></div>
                </div>
              );
            })}
            {viewingOpen && (
              <button className="btn sm" onClick={() => openSheet('openingBalance')}>Set opening balance</button>
            )}
          </Card>

          {viewingOpen && (
            <button className="btn p" onClick={() => openSheet('closeDay')}>Close day &amp; hand over</button>
          )}
        </div>
      </div>
    </>
  );
}
