/**
 * Printing and export. Everything is written into the hidden .slipwrap
 * element, which is the only thing visible to the printer (see index.css).
 */

const SLIP_ID = 'slip';

function writeSlip(html) {
  const el = document.getElementById(SLIP_ID);
  if (!el) return false;
  el.innerHTML = html;
  return true;
}

export function printHTML(html) {
  if (!writeSlip(html)) return;
  window.print();
  // Leave the markup in place briefly so the print preview can read it.
  setTimeout(() => writeSlip(''), 500);
}

const esc = (v) =>
  String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const HOTEL = {
  name: 'THE MIDTOWN HOTEL',
  address: 'Krishna Vatika Colony, Boidardar Road, Raigarh, Chhattisgarh 496001',
  gstin: '22AAECM1234F1Z5',
  phone: '92384 17169'
};

/** 80 mm thermal slip — restaurant bill or kitchen order slip. */
export function printSlip({ title, who, items, withTax = false, note = '' }) {
  const sub = items.reduce((s, c) => s + c.p * c.q, 0);
  const gst = withTax ? Math.round(sub * 0.05) : 0;
  printHTML(`<div style="width:300px;padding:14px">
    <div style="text-align:center"><b>${esc(HOTEL.name)}</b><br>${esc(title)}<br>GSTIN ${HOTEL.gstin}</div><hr>
    ${esc(who)} · ${new Date().toLocaleString('en-IN')}<hr>
    <table style="width:100%">${items
      .map((c) => `<tr><td>${esc(c.q)}× ${esc(c.n)}</td><td style="text-align:right">${c.p * c.q}</td></tr>`)
      .join('')}</table><hr>
    <table style="width:100%">
      <tr><td>Subtotal</td><td style="text-align:right">${sub}</td></tr>
      ${withTax ? `<tr><td>CGST 2.5%</td><td style="text-align:right">${(gst / 2).toFixed(2)}</td></tr>
      <tr><td>SGST 2.5%</td><td style="text-align:right">${(gst / 2).toFixed(2)}</td></tr>` : ''}
      <tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${sub + gst}</b></td></tr>
    </table>
    ${note ? `<hr>Note: ${esc(note)}` : ''}<hr>
    <div style="text-align:center">Thank you, visit again</div>
  </div>`);
}

/** A4 tax invoice. */
export function printInvoice({ no, date, party, gstin, items, totals }) {
  printHTML(`<div style="padding:20px;font-family:Arial,sans-serif">
    <h2>${esc(HOTEL.name)} — TAX INVOICE</h2>
    <p>${esc(HOTEL.address)}<br>GSTIN ${HOTEL.gstin} · Ph ${HOTEL.phone}</p>
    <p>Invoice ${esc(no)} · ${esc(date)}<br>Billed to: ${esc(party)} · GSTIN ${esc(gstin || 'Unregistered')}</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
      <tr><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>GST%</th><th>Amount</th></tr>
      ${items
        .map((i) => `<tr><td>${esc(i.d)}</td><td>9963</td><td>${i.q}</td><td>${i.r}</td><td>${i.gst}%</td>
          <td>${(i.q * i.r * (1 + i.gst / 100)).toFixed(2)}</td></tr>`)
        .join('')}
    </table>
    <p>Taxable ${totals.sub.toFixed(2)} · CGST ${(totals.gst / 2).toFixed(2)} ·
       SGST ${(totals.gst / 2).toFixed(2)} · <b>Total ${Math.round(totals.sub + totals.gst)}</b></p>
    <p style="margin-top:30px;text-align:right">For The Midtown Hotel<br><br>Authorised signatory</p>
  </div>`);
}

/** Any tabular report, printed as A4. */
export function printReport({ title, date, head, rows, summary }) {
  printHTML(`<div style="padding:18px;font-family:Arial,sans-serif">
    <h2>The Midtown Hotel — ${esc(title)}</h2>
    <p>Business date ${esc(date)} · printed ${new Date().toLocaleString('en-IN')}</p>
    <table border="1" cellpadding="5" style="border-collapse:collapse;width:100%;font-size:11px">
      <tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
      ${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
    </table>
    ${summary ? `<p><b>${esc(summary)}</b></p>` : ''}
  </div>`);
}

/** Download the report as a spreadsheet Excel opens directly. */
export function downloadExcel({ title, date, head, rows }) {
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
    <table border="1">
      <tr><td colspan="${head.length}"><b>The Midtown Hotel — ${esc(title)} — ${esc(date)}</b></td></tr>
      <tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
      ${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
    </table></body></html>`;

  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Midtown-${title.replace(/\s+/g, '-').toLowerCase()}-${date}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/* ------------------------------------------------------------ guest bill */

const inr = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function billDocument({ title, sections, guest, room, checkIn, checkOut, no, payments, note }) {
  const live = sections.filter((s) => s.lines.length);
  const rows = live.map((s) => `
    <tr><td colspan="4" style="background:#f1efe9"><b>${esc(s.title)}</b> <span style="color:#777">· GST ${s.rate}%</span></td></tr>
    ${s.lines.map((l) => `<tr><td>${esc(l.d)}</td><td style="text-align:right">${esc(l.q)}</td>
      <td style="text-align:right">${inr(l.rate)}</td><td style="text-align:right">${inr(l.amount)}</td></tr>`).join('')}`).join('');

  const tax = live.map((s) => `<tr><td>${esc(s.title)}</td><td style="text-align:right">${s.rate}%</td>
    <td style="text-align:right">${inr(s.taxable)}</td><td style="text-align:right">${inr(s.cgst)}</td>
    <td style="text-align:right">${inr(s.sgst)}</td><td style="text-align:right">${inr(s.total)}</td></tr>`).join('');

  const total = live.reduce((a, s) => a + s.total, 0);
  const cgst = live.reduce((a, s) => a + s.cgst, 0);
  const sgst = live.reduce((a, s) => a + s.sgst, 0);
  const taxable = live.reduce((a, s) => a + s.taxable, 0);

  return `<div style="padding:22px;font-family:Arial,sans-serif;font-size:12px;page-break-after:always">
    <div style="text-align:center"><h2 style="margin:0">${esc(HOTEL.name)}</h2>
      ${esc(HOTEL.address)}<br>GSTIN ${HOTEL.gstin} · Ph ${HOTEL.phone}</div>
    <h3 style="text-align:center;margin:12px 0">${esc(title)}</h3>
    <table style="width:100%;margin-bottom:8px"><tr>
      <td>Guest: <b>${esc(guest)}</b><br>Room: ${esc(room)}</td>
      <td style="text-align:right">${no ? `Bill no: ${esc(no)}<br>` : ''}Stay: ${esc(checkIn)} to ${esc(checkOut)}<br>Printed: ${new Date().toLocaleString('en-IN')}</td>
    </tr></table>
    <table border="1" cellpadding="5" style="border-collapse:collapse;width:100%">
      <tr><th style="text-align:left">Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${rows}
    </table>
    <table border="1" cellpadding="5" style="border-collapse:collapse;width:100%;margin-top:10px;font-size:11px">
      <tr><th style="text-align:left">Tax summary</th><th>GST</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>Total</th></tr>${tax}
      <tr><td><b>Total</b></td><td></td><td style="text-align:right">${inr(taxable)}</td>
        <td style="text-align:right">${inr(cgst)}</td><td style="text-align:right">${inr(sgst)}</td>
        <td style="text-align:right"><b>${inr(total)}</b></td></tr>
    </table>
    <p style="text-align:right;font-size:15px;margin:10px 0"><b>Amount payable: ₹${inr(total)}</b></p>
    ${payments?.length ? `<p>Paid by: ${payments.map((p) => `${esc(p.mode)} ₹${inr(p.amount)}`).join(' · ')}</p>` : ''}
    ${note ? `<p>${esc(note)}</p>` : ''}
    <p style="margin-top:34px;text-align:right">For The Midtown Hotel<br><br>Authorised signatory</p>
  </div>`;
}

/**
 * Prints a guest bill. `which`: 'combined' | 'stay' | 'food' | 'other' | 'separate'
 * ('separate' prints one bill per non-empty section, each on its own page).
 */
export function printBill({ bill, which = 'combined', ...meta }) {
  const live = bill.sections.filter((s) => s.lines.length);
  if (!live.length) return false;
  const doc = (sections, title) => billDocument({ ...meta, sections, title });

  let html;
  if (which === 'separate') {
    html = live.map((s) => doc([s], `${s.title} bill`)).join('');
  } else if (which === 'combined') {
    html = doc(live, meta.title || 'Tax invoice — combined bill');
  } else {
    const s = bill.sections.find((x) => x.key === which);
    if (!s?.lines.length) return false;
    html = doc([s], `${s.title} bill`);
  }
  printHTML(html);
  return true;
}
