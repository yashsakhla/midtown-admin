import { useState } from 'react';
import Field, { Row2 } from '../components/Field';
import Sheet from '../components/Sheet';
import { money } from '../lib/format';
import { printTaxBill } from '../lib/print';
import { useHotel } from '../store/HotelContext';

/**
 * Print a bill for a kitchen order (kind "kot") or an online order (kind "online").
 * CGST and SGST are typed in as rupee amounts and added to the taxable amount.
 */
export function BillSheet({ kind, id }) {
  const { db } = useHotel();
  const [tax, setTax] = useState({ cgst: '', sgst: '' });

  const rec = kind === 'kot' ? db.kots.find((k) => k.id === id) : db.online.find((o) => o.id === id);
  if (!rec) return null;

  const isKot = kind === 'kot';
  const lines = isKot ? rec.items : [{ n: rec.items || 'Online order', q: 1, p: rec.amount }];
  const who = isKot ? (rec.room ? `Room ${rec.room}` : rec.table || 'Walk-in') : `${rec.plat} order`;
  const ref = isKot ? rec.no : rec.oid;
  const taxable = lines.reduce((s, l) => s + l.p * l.q, 0);
  const cgst = Math.max(0, Number(tax.cgst) || 0);
  const sgst = Math.max(0, Number(tax.sgst) || 0);
  const total = taxable + cgst + sgst;
  const set = (k) => (e) => setTax((t) => ({ ...t, [k]: e.target.value }));
  const half = (pct) => () => {
    const v = String(Math.round(taxable * pct * 100) / 100);
    setTax({ cgst: v, sgst: v });
  };

  return (
    <Sheet
      title={`Print bill — ${who}`}
      footer={
        <button className="btn p" onClick={() => printTaxBill({ title: 'TAX INVOICE', who, ref, lines, cgst, sgst })}>
          Print bill · {money(total)}
        </button>
      }
    >
      <table>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}><td>{l.q}× {l.n}</td><td className="rt num">{money(l.p * l.q)}</td></tr>
          ))}
          <tr><td><b>Taxable amount</b></td><td className="rt num" style={{ color: 'var(--ink)' }}>{money(taxable)}</td></tr>
        </tbody>
      </table>

      <div style={{ height: 10 }} />
      <Row2>
        <Field label="CGST amount (₹)" type="number" placeholder="0" value={tax.cgst} onChange={set('cgst')} />
        <Field label="SGST amount (₹)" type="number" placeholder="0" value={tax.sgst} onChange={set('sgst')} />
      </Row2>
      <div className="chips">
        <button type="button" onClick={half(0.025)}>2.5% + 2.5%</button>
        <button type="button" onClick={half(0.06)}>6% + 6%</button>
        <button type="button" onClick={() => setTax({ cgst: '', sgst: '' })}>No tax</button>
      </div>

      <table>
        <tbody>
          <tr><td>CGST</td><td className="rt num">{money(cgst)}</td></tr>
          <tr><td>SGST</td><td className="rt num">{money(sgst)}</td></tr>
          <tr>
            <td><b>Bill total</b></td>
            <td className="rt num" style={{ fontSize: 16, color: 'var(--ink)' }}>{money(total)}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '10px 0 14px' }}>
        The tax amounts are added to the printed bill only. They are not saved or posted to the day book.
      </p>
    </Sheet>
  );
}
