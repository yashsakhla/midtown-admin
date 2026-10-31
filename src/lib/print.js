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
