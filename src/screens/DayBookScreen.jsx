import Card from '../components/Card';
import DateBar from '../components/DateBar';
import { Kpi, KpiGrid } from '../components/Kpi';
import Pill from '../components/Pill';
import { sourceLabel } from '../api/mappers';
import { fmtClock, fmtDate, money } from '../lib/format';
import { printReport } from '../lib/print';
import { buildReport } from '../lib/reports';
import {
  byMode, cashInHand, closingBalance, PAYMENT_MODES, totalPayout, totalReceipt, totalWithdraw, isWithdraw
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

const sumOf = (rows) => rows.filter((e) => !e.udhari).reduce((t, e) => t + e.amount, 0);

/** One side of the register: incoming (credits) or outgoing (debits), as a table with its own total. */
function RegTable({ title, tone, rows, openLine, shortage = 0 }) {
  const total = sumOf(rows) + shortage;
  return (
    <div className={`reg-col ${tone}`}>
      <div className="reg-head">
        <b>{title}</b>
        <span>{rows.length} entr{rows.length === 1 ? 'y' : 'ies'}</span>
      </div>
      <div className="rpt-wrap bk-table">
        <table className="rpt">
          <thead>
            <tr><th>Time</th><th>Particulars</th><th className="rt">Amount</th></tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((e) => {
              const auto = e.source && e.source !== 'MANUAL';
              return (
                <tr key={e.id} onClick={() => openLine(e)} style={{ cursor: 'pointer' }}>
                  <td>{e.time || '—'}</td>
                  <td className="guest">
                    <b>{e.room ? `${e.room} · ` : ''}{e.guest || e.type}</b>
                    <span>
                      {isWithdraw(e) ? <b style={{ color: '#A55A00' }}>Withdraw</b> : e.type} · {e.udhari ? 'Udhari' : e.mode}{e.narration ? ` · ${e.narration}` : ''}
                      {auto && <> · <em style={{ fontStyle: 'normal', color: 'var(--blue)' }}>{sourceLabel(e.source)}</em></>}
                    </span>
                    {e.shortfall > 0 && <span style={{ color: 'var(--red)', fontWeight: 600 }}>Short received {money(e.shortfall)}</span>}
                  </td>
                  <td className="rt num amt" style={{ color: e.udhari ? '#A55A00' : tone === 'in' ? 'var(--green)' : 'var(--red)' }}>
                    {money(e.amount)}
                    {e.udhari && <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)', fontWeight: 500 }}>on credit · not paid</span>}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={3} className="empty">No {title.toLowerCase()} entries on this date.</td></tr>
            )}
            {shortage > 0 && (
              <tr>
                <td>—</td>
                <td className="guest"><b style={{ color: 'var(--red)' }}>Cash shortage at close</b><span>Counted less than expected</span></td>
                <td className="rt num amt" style={{ color: 'var(--red)' }}>{money(shortage)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr><td colSpan={2}>Total {title.toLowerCase()}</td><td className="rt num">{money(total)}</td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function DayBookScreen() {
  const { db, openSheet } = useHotel();

  const maxMode = Math.max(...PAYMENT_MODES.map((m) => byMode(db, m)), 1);
  const openDay = db.day?.status === 'OPEN';
  const viewingOpen = openDay && db.day.businessDate === db.date;
  const short = db.cash.shortage > 0 ? db.cash.shortage : 0;
  const incoming = db.register.filter((e) => e.dc === 'credit');
  const outgoing = db.register.filter((e) => e.dc !== 'credit');
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
        <Kpi icon="up" tone="red" value={money(totalPayout(db))} label="Total payout" note="incl. expenses & withdraw" />
        <Kpi icon="wallet" tone="gold" value={money(cashInHand(db))} label="Cash in hand" note="expected in drawer" />
        <Kpi icon="check" tone="green" value={money(closingBalance(db))} label="Closing balance" />
        <Kpi icon="up" tone="gold" value={money(totalWithdraw(db))} label="Withdraw" note="taken from account" />
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
          <div className="reg-split">
            <RegTable title="Incoming" tone="in" rows={incoming} openLine={openLine} />
            <RegTable title="Outgoing" tone="out" rows={outgoing} openLine={openLine} shortage={short} />
          </div>
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
