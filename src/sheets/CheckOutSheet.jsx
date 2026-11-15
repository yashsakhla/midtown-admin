import { useEffect, useMemo, useState } from 'react';
import Field, { Row2 } from '../components/Field';
import Pill from '../components/Pill';
import Sheet from '../components/Sheet';
import { api } from '../api/client';
import { buildBill, manualBill, SECTION_TITLES } from '../lib/billing';
import { fmtDate, money } from '../lib/format';
import { printBill } from '../lib/print';
import { REQUEST_STATUS } from '../lib/requests';
import { PAYMENT_MODES } from '../lib/selectors';
import { useHotel } from '../store/HotelContext';

const ADJ_LABEL = { DISCOUNT_PERCENT: 'Discount (%)', DISCOUNT_FLAT: 'Discount (₹)', HALF_DAY: 'Half day', COMPLIMENTARY: 'Complimentary' };
const h3 = { margin: '16px 0 8px', fontSize: 14 };
const note = (bg, color) => ({ background: bg, color, borderRadius: 11, padding: '10px 12px', fontSize: 12.5, margin: '8px 0' });

export function CheckOutSheet({ no }) {
  const { db, actions, toast } = useHotel();
  const room = db.rooms.find((r) => r.no === no);

  const bill = useMemo(() => (room ? buildBill(room, db) : null), [room, db]);
  const [payments, setPayments] = useState([{ mode: 'Cash', amount: String(room?.folio ?? 0) }]);
  const [payTouched, setPayTouched] = useState(false);
  const [adjustments, setAdjustments] = useState([]);   // discount / half day / complimentary
  const [narration, setNarration] = useState('Final settlement');
  const [manualOn, setManualOn] = useState(false);
  const [manual, setManual] = useState(() => (bill ? Object.fromEntries(bill.sections.map((s) => [s.key, String(Math.round(s.amount))])) : {}));
  const [manualRate, setManualRate] = useState(() => (bill ? Object.fromEntries(bill.sections.map((s) => [s.key, String(s.rate)])) : {}));

  /* ---- discount / half day / complimentary ---- */
  const adjAmount = (a) => {
    if (!bill) return 0;
    const v = Number(a.value) || 0;
    if (a.kind === 'DISCOUNT_PERCENT') return (bill.total * Math.min(100, v)) / 100;
    if (a.kind === 'DISCOUNT_FLAT') return v;
    if (a.kind === 'HALF_DAY') return (room?.stayRate || 0) / 2;
    if (a.kind === 'COMPLIMENTARY') return a.section === 'all' ? bill.total : (bill.sections.find((s) => s.key === a.section)?.total || 0);
    return 0;
  };
  const rawOff = adjustments.reduce((t, a) => t + adjAmount(a), 0);
  const folio = room?.folio ?? 0;
  const off = Math.min(Math.max(0, folio), Math.round(rawOff * 100) / 100);
  const net = Math.max(0, folio - off);          // what the guest actually pays

  // Keep the single payment row in step with the net amount until it is edited by hand.
  useEffect(() => {
    if (!payTouched) setPayments((ps) => (ps.length === 1 ? [{ ...ps[0], amount: String(net) }] : ps));
  }, [net, payTouched]);

  /* ---- check-out date: due today, or already passed ---- */
  const asOf = db.day?.status === 'OPEN' && db.day.businessDate ? db.day.businessDate : db.date;
  const endDate = room?.checkOut || '';
  const lateNights = endDate ? Math.max(0, Math.round((new Date(asOf) - new Date(endDate)) / 86400000)) : 0;
  const dueToday = !!endDate && endDate === asOf;
  const rate = room?.stayRate || 0;
  const [busyNight, setBusyNight] = useState(false);
  const chargeNights = async (n, reason) => {
    setBusyNight(true);
    await actions.addExtraNights(no, n, reason);
    setBusyNight(false);
  };

  if (!room) return null;
  const requests = db.requests.filter((r) => r.stayId === room.stayId);

  const addAdj = (kind) => setAdjustments((l) => [...l, { kind, value: '', section: 'all', reason: '' }]);
  const setAdj = (i, k, v) => setAdjustments((l) => l.map((a, n) => (n === i ? { ...a, [k]: v } : a)));
  const dropAdj = (i) => setAdjustments((l) => l.filter((_, n) => n !== i));

  /* ---- split payment ---- */
  const collected = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const short = Math.max(0, net - collected);
  const extra = Math.max(0, collected - net);
  const setRow = (i, k) => (e) => { setPayTouched(true); setPayments((ps) => ps.map((p, n) => (n === i ? { ...p, [k]: e.target.value } : p))); };
  const addRow = () => {
    setPayTouched(true);
    setPayments((ps) => {
      const used = ps.map((p) => p.mode);
      const mode = PAYMENT_MODES.find((m) => !used.includes(m)) || 'Cash';
      return [...ps, { mode, amount: String(Math.max(0, net - collected)) }];
    });
  };
  const dropRow = (i) => { setPayTouched(true); setPayments((ps) => ps.filter((_, n) => n !== i)); };

  /* ---- printing ---- */
  const meta = {
    guest: room.guest || '', room: `${room.no} · ${room.type}`, checkIn: room.checkIn, checkOut: room.checkOut || db.date,
    no: room.stayId ? `MTH-${String(room.stayId).slice(-6).toUpperCase()}` : '',
    payments: payments.filter((p) => Number(p.amount) > 0)
  };
  const print = (which) => {
    if (!printBill({ bill, which, ...meta })) toast('Nothing to print for that section');
  };

  const manualBillData = manualBill(bill, manual, manualRate);
  const printManual = (which) => {
    if (!printBill({ bill: manualBillData, which, ...meta, title: 'Bill' })) { toast('Enter an amount to print'); return; }
    // Audit only: the server logs that a custom bill was printed. It never changes the books.
    api.post(`/stays/${room.stayId}/bill-prints`, {
      type: 'MANUAL', which, amounts: manual, gstRates: manualRate, gstMode: 'EXCLUSIVE', actualAmounts: Object.fromEntries(bill.sections.map((s) => [s.key, s.amount]))
    }).catch(() => {});
  };

  return (
    <Sheet
      title={`Check out — Room ${no}`}
      footer={
        <button className="btn p" disabled={lateNights > 0} onClick={() => actions.checkOut(no, {
          payments, narration, net,
          adjustments: adjustments.map((a) => ({ kind: a.kind, value: Number(a.value) || 0, section: a.section, reason: a.reason, amount: Math.round(adjAmount(a) * 100) / 100 })).filter((a) => a.amount > 0)
        })}>
          {lateNights > 0 ? `Add ${lateNights} extra night${lateNights > 1 ? 's' : ''} to settle` : 'Settle & check out'}
        </button>
      }
    >
      <Field label="Guest" value={room.guest || ''} disabled readOnly />

      {lateNights > 0 && (
        <div style={{ borderLeft: '4px solid var(--red)', background: '#FDF2F1', color: 'var(--red)', borderRadius: 11, padding: '10px 12px', fontSize: 13, margin: '0 0 10px' }}>
          <b>Check-out date passed</b> — the stay ended on {fmtDate(endDate)}, {lateNights} night{lateNights > 1 ? 's' : ''} ago.
          <div style={{ margin: '4px 0 8px' }}>
            Extra nights: {lateNights} × {money(rate)} = <b>{money(lateNights * rate)}</b>. Add this to the folio before you can settle and check out.
          </div>
          <button type="button" className="btn p" disabled={busyNight} onClick={() => chargeNights(lateNights, 'Stayed past check-out date')}>
            {busyNight ? 'Adding…' : `Add ${lateNights} extra night${lateNights > 1 ? 's' : ''} · ${money(lateNights * rate)}`}
          </button>
        </div>
      )}
      {dueToday && (
        <div style={note('var(--ow)', '#A55A00')}>
          <b>Check-out is today.</b> If the guest is staying on or checking out late, you can charge one more night at {money(rate)}.
          <div style={{ marginTop: 6 }}>
            <button type="button" className="btn sm" disabled={busyNight} onClick={() => chargeNights(1, 'Late check-out / extra night')}>
              {busyNight ? 'Adding…' : `Add 1 extra night · ${money(rate)}`}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ generated bill */}
      <h3 style={{ margin: '4px 0 8px', fontSize: 14 }}>Generated bill</h3>
      <table>
        <tbody>
          {bill.sections.map((s) => s.lines.length > 0 && (
            <tr key={s.key}>
              <td colSpan={2} style={{ padding: 0 }}>
                <table>
                  <tbody>
                    <tr><td><b style={{ color: 'var(--ink)' }}>{s.title}</b> <span style={{ color: 'var(--muted)' }}>· GST {s.rate}%</span></td><td className="rt num" style={{ color: 'var(--ink)' }}>{money(s.amount)}</td></tr>
                    {s.lines.map((l, i) => (
                      <tr key={i}><td style={{ fontSize: 12.5, paddingLeft: 14 }}>{l.d}{l.q > 1 ? ` · ${l.q} × ${money(l.rate)}` : ''}</td><td className="rt num" style={{ fontSize: 12.5 }}>{money(l.amount)}</td></tr>
                    ))}
                    <tr><td style={{ fontSize: 12, color: 'var(--muted)', paddingLeft: 14 }}>CGST {s.rate / 2}% {money(s.cgst)} · SGST {s.rate / 2}% {money(s.sgst)}</td><td /></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          ))}
          <tr><td><b>Bill total (incl. CGST + SGST)</b></td><td className="rt num" style={{ color: 'var(--ink)' }}>{money(bill.total)}</td></tr>
          <tr><td><b>Balance to collect (updated folio)</b></td><td className="rt num" style={{ color: 'var(--ink)' }}>{money(room.folio)}</td></tr>
        </tbody>
      </table>

      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 6px' }}>Print as</p>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        <button type="button" onClick={() => print('combined')}>All combined</button>
        <button type="button" onClick={() => print('stay')}>Stay only</button>
        <button type="button" onClick={() => print('food')}>Food only</button>
        <button type="button" onClick={() => print('other')}>Other only</button>
        <button type="button" onClick={() => print('separate')}>Separate bills</button>
      </div>

      {requests.length > 0 && (
        <>
          <h3 style={h3}>Guest requests for this stay</h3>
          {requests.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span><b style={{ color: 'var(--ink)' }}>{r.label}</b>{r.note ? ` — ${r.note}` : ''} · {r.time}</span>
              <Pill tone={(r.expired ? REQUEST_STATUS.EXPIRED : REQUEST_STATUS[r.status])?.tone}>
                {(r.expired ? REQUEST_STATUS.EXPIRED : REQUEST_STATUS[r.status])?.label}
              </Pill>
            </div>
          ))}
          {requests.some((r) => ['SENT', 'IN_PROGRESS'].includes(r.status)) && (
            <p style={{ fontSize: 12, color: 'var(--red)', margin: '4px 0 0' }}>
              Some requests are still open — they expire when you check out.
            </p>
          )}
        </>
      )}

      {/* ------------------------------------------------ manual bill, print only */}
      <h3 style={h3}>Manual bill <Pill tone="n">print only</Pill></h3>
      {!manualOn ? (
        <button className="btn sm" onClick={() => setManualOn(true)}>Create a manual bill</button>
      ) : (
        <>
          <table>
            <thead>
              <tr><td style={{ fontSize: 11.5 }}>Section</td><td className="rt" style={{ fontSize: 11.5 }}>Actual</td><td className="rt" style={{ fontSize: 11.5 }}>Before GST</td><td className="rt" style={{ fontSize: 11.5 }}>GST %</td><td className="rt" style={{ fontSize: 11.5 }}>Total</td></tr>
            </thead>
            <tbody>
              {bill.sections.map((s) => {
                return (
                  <tr key={s.key}>
                    <td>{SECTION_TITLES[s.key]}</td>
                    <td className="rt num">{money(s.amount)}</td>
                    <td className="rt" style={{ width: 96 }}>
                      <input type="number" value={manual[s.key] ?? ''} style={{ padding: '6px 8px', fontSize: 14, textAlign: 'right' }}
                        onChange={(e) => setManual((m) => ({ ...m, [s.key]: e.target.value }))} />
                    </td>
                    <td className="rt" style={{ width: 64 }}>
                      <input type="number" value={manualRate[s.key] ?? ''} style={{ padding: '6px 8px', fontSize: 14, textAlign: 'right' }}
                        onChange={(e) => setManualRate((m) => ({ ...m, [s.key]: e.target.value }))} />
                    </td>
                    <td className="rt num">{money(manualBillData.sections.find((x) => x.key === s.key)?.total || 0)}</td>
                  </tr>
                );
              })}
              <tr>
                <td><b>Total</b></td>
                <td className="rt num">{money(bill.amount)}</td>
                <td className="rt num" style={{ color: 'var(--ink)' }}>{money(manualBillData.amount)}</td>
                <td />
                <td className="rt num" style={{ color: 'var(--ink)' }}>{money(manualBillData.total)}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0' }}>
            GST is added on top of the amounts you enter: CGST {money(manualBillData.cgst)} + SGST {money(manualBillData.sgst)}.
          </p>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            <button type="button" onClick={() => printManual('combined')}>Print combined</button>
            <button type="button" onClick={() => printManual('stay')}>Stay only</button>
            <button type="button" onClick={() => printManual('food')}>Food only</button>
            <button type="button" onClick={() => printManual('other')}>Other only</button>
            <button type="button" onClick={() => printManual('separate')}>Separate bills</button>
          </div>
          <div style={note('var(--ow)', '#A55A00')}>
            Print only. A manual bill never changes the folio, the day book, cash totals or reports.
            Settlement below always uses the real amounts.
          </div>
        </>
      )}

      {/* ------------------------------------------------ settle */}
      <h3 style={h3}>Settle &amp; check out</h3>

      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px' }}>Adjust the bill</p>
      <div className="chips" style={{ flexWrap: 'wrap' }}>
        <button type="button" onClick={() => addAdj('DISCOUNT_PERCENT')}>+ Discount %</button>
        <button type="button" onClick={() => addAdj('DISCOUNT_FLAT')}>+ Discount ₹</button>
        <button type="button" onClick={() => addAdj('HALF_DAY')}>+ Half day</button>
        <button type="button" onClick={() => addAdj('COMPLIMENTARY')}>+ Complimentary</button>
      </div>
      {adjustments.map((a, i) => (
        <div key={i} style={{ background: 'var(--bg)', borderRadius: 11, padding: '10px 12px', margin: '8px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <b style={{ color: 'var(--ink)' }}>{ADJ_LABEL[a.kind]}</b>
            <span>− {money(adjAmount(a))} <button type="button" className="btn sm" aria-label="Remove adjustment" onClick={() => dropAdj(i)}>✕</button></span>
          </div>
          {(a.kind === 'DISCOUNT_PERCENT' || a.kind === 'DISCOUNT_FLAT') && (
            <Field label={a.kind === 'DISCOUNT_PERCENT' ? 'Discount (%)' : 'Discount (₹)'} type="number" value={a.value} onChange={(e) => setAdj(i, 'value', e.target.value)} />
          )}
          {a.kind === 'HALF_DAY' && (
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0' }}>Charges half a night: waives {money((room.stayRate || 0) / 2)} (half of {money(room.stayRate || 0)}).</p>
          )}
          {a.kind === 'COMPLIMENTARY' && (
            <Field as="select" label="Complimentary" value={a.section} onChange={(e) => setAdj(i, 'section', e.target.value)}>
              <option value="all">Whole bill</option>
              {Object.entries(SECTION_TITLES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </Field>
          )}
          <Field label="Reason (optional)" value={a.reason} onChange={(e) => setAdj(i, 'reason', e.target.value)} />
        </div>
      ))}
      {off > 0 && (
        <table style={{ marginTop: 6 }}>
          <tbody>
            <tr><td>Balance</td><td className="rt num">{money(folio)}</td></tr>
            <tr><td style={{ color: 'var(--green)' }}>Adjustments</td><td className="rt num" style={{ color: 'var(--green)' }}>− {money(off)}</td></tr>
            <tr><td><b>Payable</b></td><td className="rt num" style={{ color: 'var(--ink)' }}>{money(net)}</td></tr>
          </tbody>
        </table>
      )}
      <div style={{ height: 8 }} />
      {payments.map((p, i) => (
        <Row2 key={i}>
          <Field as="select" label={i === 0 ? 'Payment mode' : `Payment mode ${i + 1}`} value={p.mode} onChange={setRow(i, 'mode')}>
            {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
          </Field>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><Field label="Amount" type="number" value={p.amount} onChange={setRow(i, 'amount')} /></div>
            {payments.length > 1 && (
              <button type="button" className="btn sm" aria-label="Remove payment" style={{ marginBottom: 12 }} onClick={() => dropRow(i)}>✕</button>
            )}
          </div>
        </Row2>
      ))}
      {payments.length < PAYMENT_MODES.length && (
        <button type="button" className="btn sm" onClick={addRow}>+ Add another payment mode</button>
      )}

      <table style={{ marginTop: 10 }}>
        <tbody>
          <tr><td>Balance to collect</td><td className="rt num">{money(net)}</td></tr>
          <tr><td>Collected ({payments.filter((p) => Number(p.amount) > 0).map((p) => p.mode).join(' + ') || '—'})</td><td className="rt num">{money(collected)}</td></tr>
          {short > 0 && <tr><td style={{ color: 'var(--red)' }}><b>Short</b></td><td className="rt num" style={{ color: 'var(--red)' }}>{money(short)}</td></tr>}
          {extra > 0 && <tr><td style={{ color: 'var(--green)' }}>More than the balance</td><td className="rt num" style={{ color: 'var(--green)' }}>{money(extra)}</td></tr>}
        </tbody>
      </table>
      {short > 0 && (
        <div style={{ borderLeft: '4px solid var(--red)', background: '#FDF2F1', color: 'var(--red)', borderRadius: 11, padding: '10px 12px', fontSize: 13, margin: '8px 0' }}>
          <b>Short by {money(short)}</b> — it will be highlighted in red in the day book.
        </div>
      )}

      <Field label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />
      <div style={note('var(--ow)', '#A55A00')}>
        Room turns orange for housekeeping until cleaning is marked done.
      </div>
      <div style={{ height: 12 }} />
    </Sheet>
  );
}
