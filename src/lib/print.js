/**
 * Printing and export. Everything is written into the hidden .slipwrap
 * element, which is the only thing visible to the printer (see index.css).
 *
 * A4 documents (bills, invoices, salary slips, reports) use the Hotel Mid Town
 * letterhead: header with logo, GSTIN strip, body, footer. 80 mm slips keep the
 * narrow receipt layout.
 */
import logoUrl from '../assets/logo.png';

const SLIP_ID = 'slip';

function writeSlip(html) {
  const el = document.getElementById(SLIP_ID);
  if (!el) return false;
  el.innerHTML = html;
  return true;
}

let pageStyle = null;
/** A4 letterhead pages print edge to edge, so the page margin is removed while they print. */
function setPageStyle(a4) {
  if (pageStyle) { pageStyle.remove(); pageStyle = null; }
  if (a4) {
    pageStyle = document.createElement('style');
    pageStyle.textContent = '@page{size:210mm 297mm;margin:0}';
    document.head.appendChild(pageStyle);
  }
}

export function printHTML(html, { a4 = false } = {}) {
  if (!writeSlip(html)) return;
  setPageStyle(a4);
  const go = () => {
    window.print();
    // Leave the markup in place briefly so the print preview can read it.
    setTimeout(() => { writeSlip(''); setPageStyle(false); }, 500);
  };
  // The logo must be loaded before the print dialog opens, or it prints blank.
  const pending = [...document.querySelectorAll(`#${SLIP_ID} img`)].filter((i) => !i.complete);
  if (!pending.length) { go(); return; }
  let started = false;
  const once = () => { if (!started) { started = true; go(); } };
  Promise.all(pending.map((i) => new Promise((r) => { i.onload = r; i.onerror = r; }))).then(once);
  setTimeout(once, 2000);
}

const esc = (v) =>
  String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const f = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const HOTEL = {
  name: 'HOTEL MID TOWN',
  address: 'Near Laxmi Narayan Mandir, Behind Gandhi Ganj, Raigarh – 496001, Chhattisgarh, India',
  gstin: '22ADYPA3908L3ZB',
  phone: '+91 81033 13888 | +91 78984 61388',
  email: 'midtown.rgh2007@gmail.com'
};

/* ============================================================== letterhead */

const LH_CSS = `
.lh-sheet,.lh-sheet *{box-sizing:border-box}
.lh-sheet{width:210mm;min-height:296mm;margin:0 auto;background:#fff;color:#182c45;font-family:Arial,Helvetica,sans-serif;
  display:flex;flex-direction:column;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lh-sheet:last-child{break-after:auto;page-break-after:auto}
.lh-accent{height:3mm;background:#142d4e;position:relative;flex:none}
.lh-accent:after{content:"";position:absolute;right:0;top:0;width:40%;height:100%;background:#c6a267;clip-path:polygon(8% 0,100% 0,100% 100%,0 100%)}
.lh-header{display:flex;align-items:center;gap:5mm;padding:3mm 16mm 2mm 15mm;flex:none}
.lh-logo{height:47mm;width:47mm;object-fit:contain;flex-shrink:0}
.lh-identity{flex:1}
.lh-eyebrow{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#b18c50;font-weight:bold;margin-bottom:1mm}
.lh-name{font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:700;letter-spacing:-1.2px;line-height:1.05;color:#142d4e}
.lh-sub{font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#8b96a3;margin-top:1mm}
.lh-rule{margin:0 16mm;height:1.5px;background:#d9c6a8;flex:none}
.lh-rule:before{content:"";display:block;width:34mm;height:100%;background:#142d4e}
.lh-info{margin:0 16mm;padding:2mm 0 2.5mm;display:flex;justify-content:space-between;align-items:flex-start;gap:7mm;
  border-bottom:1px solid #e5e8ed;font-size:10px;line-height:1.4;color:#526176;flex:none}
.lh-info strong{color:#142d4e;font-size:10px}
.lh-contact{text-align:right;white-space:nowrap}
.lh-body{flex:1;padding:6mm 16mm 8mm;font-size:11px;line-height:1.45}
.lh-footer{flex:none;margin-top:auto}
.lh-footer-line{height:2px;background:linear-gradient(to right,#142d4e 0%,#142d4e 65%,#c6a267 65%,#c6a267 100%);margin:0 16mm}
.lh-footer-inner{display:flex;justify-content:space-between;align-items:center;gap:10mm;padding:5mm 16mm 7mm;font-size:9px;color:#69778a;line-height:1.6}
.lh-footer-inner b{color:#142d4e;letter-spacing:1.4px}
.lh-footer-bottom{height:4mm;background:#142d4e}

.lh-title{font-family:Georgia,'Times New Roman',serif;font-size:19px;letter-spacing:1.5px;text-transform:uppercase;color:#142d4e;text-align:center;margin:0 0 5mm}
.lh-title:after{content:"";display:block;width:22mm;height:1.5px;background:#c6a267;margin:2mm auto 0}
.lh-meta{display:flex;gap:5mm;margin-bottom:5mm}
.lh-box{flex:1;border:1px solid #e5e8ed;border-radius:2mm;padding:3mm 4mm;line-height:1.6}
.lh-box.r{text-align:right}
.lh-k{display:block;font-size:8.5px;letter-spacing:1.6px;text-transform:uppercase;color:#b18c50;font-weight:bold;margin-bottom:1mm}
.lh-box b{color:#142d4e}
.lh-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #e5e8ed;border-radius:2mm;margin-bottom:5mm;overflow:hidden}
.lh-grid div{padding:2.5mm 4mm;border-right:1px solid #e5e8ed}
.lh-grid div:last-child{border-right:0}
.lh-grid b{display:block;color:#142d4e;font-size:12px}
.lh-t{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4mm}
.lh-t th{background:#142d4e;color:#fff;text-align:left;font-weight:600;padding:2.2mm 2.5mm;font-size:10px;letter-spacing:.4px}
.lh-t td{padding:2.2mm 2.5mm;border-bottom:1px solid #e5e8ed}
.lh-t tbody tr:nth-child(even) td{background:#f8f9fb}
.lh-t .r{text-align:right;font-variant-numeric:tabular-nums}
.lh-t .c{text-align:center}
.lh-t tr{break-inside:avoid;page-break-inside:avoid}
.lh-t tr.sec td{background:#f3ead9!important;color:#142d4e;font-weight:bold;border-bottom:1px solid #d9c6a8}
.lh-t tr.sec span{color:#8b96a3;font-weight:normal}
.lh-t tfoot td{font-weight:bold;color:#142d4e;background:#eef1f5;border-top:2px solid #142d4e}
.lh-small{font-size:9.5px}
.lh-small th,.lh-small td{padding:1.6mm 2mm}
.lh-totals{margin-left:auto;width:74mm;border:1px solid #e5e8ed;border-radius:2mm;overflow:hidden;margin-bottom:5mm;break-inside:avoid}
.lh-totals div{display:flex;justify-content:space-between;padding:2mm 4mm;border-bottom:1px solid #e5e8ed;font-size:11px}
.lh-totals div:last-child{border-bottom:0}
.lh-totals .grand{background:#142d4e;color:#fff;font-size:13px;font-weight:bold}
.lh-note{font-size:10px;color:#526176;margin:2mm 0}
.lh-sign{display:flex;justify-content:space-between;align-items:flex-end;margin-top:16mm;font-size:10.5px;color:#526176;break-inside:avoid}
.lh-sign div{text-align:center;min-width:52mm}
.lh-sign div span{display:block;border-top:1px solid #142d4e;padding-top:1.5mm;margin-top:11mm}
.lh-sign b{color:#142d4e}
.lh-terms{margin-top:6mm;font-size:9px;color:#8b96a3;line-height:1.5}
`;

const letterhead = (inner) => `<div class="lh-sheet">
  <div class="lh-accent"></div>
  <header class="lh-header">
    <img class="lh-logo" alt="Hotel Mid Town logo" src="${logoUrl}" />
    <div class="lh-identity">
      <div class="lh-eyebrow">A Comfort Stay</div>
      <div class="lh-name">Hotel Mid Town</div>
      <div class="lh-sub">Raigarh · Chhattisgarh</div>
    </div>
  </header>
  <div class="lh-rule"></div>
  <section class="lh-info">
    <div><strong>Near Laxmi Narayan Mandir, Behind Gandhi Ganj</strong><br>Raigarh – 496001, Chhattisgarh, India<br><strong>GSTIN:</strong> ${HOTEL.gstin}</div>
    <div class="lh-contact"><strong>${HOTEL.phone.replace('|', '&nbsp;&nbsp;|&nbsp;&nbsp;')}</strong><br>${HOTEL.email}</div>
  </section>
  <div class="lh-body">${inner}</div>
  <footer class="lh-footer">
    <div class="lh-footer-line"></div>
    <div class="lh-footer-inner">
      <div><b>HOTEL MID TOWN</b><br>A Comfort Stay</div>
      <div style="text-align:right">Behind Gandhi Ganj, Raigarh – 496001<br>GSTIN: ${HOTEL.gstin}</div>
    </div>
    <div class="lh-footer-bottom"></div>
  </footer>
</div>`;

/** Prints one or more letterhead pages. */
const printA4 = (...sheets) => printHTML(`<style>${LH_CSS}</style>${sheets.join('')}`, { a4: true });

const signature = (left = 'Customer signature', right = 'Authorised signatory') =>
  `<div class="lh-sign"><div><span>${left}</span></div><div><b>For Hotel Mid Town</b><span>${right}</span></div></div>`;

const totalsBox = (rows, grandLabel, grand) => `<div class="lh-totals">
  ${rows.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('')}
  <div class="grand"><span>${grandLabel}</span><span>₹${f(grand)}</span></div></div>`;

/* ================================================================ 80 mm slips */

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

/** 80 mm bill for a kitchen order or an online order, with CGST / SGST typed in as rupee amounts. */
export function printTaxBill({ title, who, ref, lines, cgst = 0, sgst = 0 }) {
  const sub = lines.reduce((s, l) => s + l.p * l.q, 0);
  const total = sub + cgst + sgst;
  printHTML(`<div style="width:300px;padding:14px">
    <div style="text-align:center"><b>${esc(HOTEL.name)}</b><br>${esc(HOTEL.address)}<br>GSTIN ${HOTEL.gstin}<br><b>${esc(title)}</b></div><hr>
    ${esc(who)}${ref ? ` · ${esc(ref)}` : ''}<br>${new Date().toLocaleString('en-IN')}<hr>
    <table style="width:100%">${lines
      .map((l) => `<tr><td>${esc(l.q)}× ${esc(l.n)}</td><td style="text-align:right">${(l.p * l.q).toFixed(2)}</td></tr>`)
      .join('')}</table><hr>
    <table style="width:100%">
      <tr><td>Taxable amount</td><td style="text-align:right">${sub.toFixed(2)}</td></tr>
      <tr><td>CGST</td><td style="text-align:right">${cgst.toFixed(2)}</td></tr>
      <tr><td>SGST</td><td style="text-align:right">${sgst.toFixed(2)}</td></tr>
      <tr><td><b>TOTAL</b></td><td style="text-align:right"><b>${total.toFixed(2)}</b></td></tr>
    </table><hr>
    <div style="text-align:center">Thank you, visit again</div>
  </div>`);
}

/* ================================================================ A4 invoices */

/** A4 GST invoice for a room stay (rooms only, no restaurant lines). */
export function printRoomInvoice(d) {
  const half = d.rate / 2;
  printA4(letterhead(`
    <h1 class="lh-title">Tax Invoice — Room</h1>
    <div class="lh-meta">
      <div class="lh-box"><span class="lh-k">Billed to</span><b>${esc(d.guest || d.party)}</b>${d.phone ? `<br>Phone: ${esc(d.phone)}` : ''}<br>GSTIN: ${esc(d.gstin || 'Unregistered')}</div>
      <div class="lh-box r"><span class="lh-k">Invoice details</span>Invoice no: <b>${esc(d.no)}</b><br>Date: ${esc(d.date)}</div>
    </div>
    <div class="lh-grid">
      <div><span class="lh-k">Room</span><b>${esc(d.room)}</b>${d.type ? esc(d.type) : ''}</div>
      <div><span class="lh-k">No. of persons</span><b>${esc(d.persons)}</b></div>
      <div><span class="lh-k">Check-in</span><b>${esc(d.checkIn)}</b></div>
      <div><span class="lh-k">Check-out</span><b>${esc(d.checkOut)}</b></div>
    </div>
    <table class="lh-t">
      <thead><tr><th>Description</th><th class="c">HSN/SAC</th><th class="r">Nights</th><th class="r">Rate / night</th>
        <th class="r">Taxable</th><th class="r">CGST ${half}%</th><th class="r">SGST ${half}%</th><th class="r">Amount</th></tr></thead>
      <tbody><tr><td>${esc(d.desc)}</td><td class="c">9963</td><td class="r">${esc(d.nights)}</td><td class="r">${f(d.rateNight)}</td>
        <td class="r">${f(d.taxable)}</td><td class="r">${f(d.cgst)}</td><td class="r">${f(d.sgst)}</td><td class="r">${f(d.total)}</td></tr></tbody>
    </table>
    ${totalsBox([
      ['Taxable value', f(d.taxable)], [`CGST (${half}%)`, f(d.cgst)], [`SGST (${half}%)`, f(d.sgst)],
      ...(d.roundOff ? [['Round off', f(d.roundOff)]] : [])
    ], 'Total payable', d.grand)}
    ${signature()}
    <p class="lh-terms">Check-out time is as per hotel policy. Goods and services once supplied are not returnable. Subject to Raigarh jurisdiction.</p>`));
}

/** A4 GST invoice for food (restaurant, room service or online order). */
export function printFoodInvoice(d) {
  const half = d.rate / 2;
  printA4(letterhead(`
    <h1 class="lh-title">Tax Invoice — Food</h1>
    <div class="lh-meta">
      <div class="lh-box"><span class="lh-k">Billed to</span><b>${esc(d.party)}</b>${d.phone ? `<br>Phone: ${esc(d.phone)}` : ''}${d.where ? `<br>${esc(d.where)}` : ''}<br>GSTIN: ${esc(d.gstin || 'Unregistered')}</div>
      <div class="lh-box r"><span class="lh-k">Invoice details</span>Invoice no: <b>${esc(d.no)}</b><br>Date: ${esc(d.date)}</div>
    </div>
    <table class="lh-t">
      <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>${d.lines.map((l) => `<tr><td>${esc(l.n)}</td><td class="r">${esc(l.q)}</td><td class="r">${f(l.p)}</td><td class="r">${f(l.q * l.p)}</td></tr>`).join('')}</tbody>
    </table>
    ${totalsBox([
      ['Taxable value', f(d.taxable)], [`CGST (${half}%)`, f(d.cgst)], [`SGST (${half}%)`, f(d.sgst)],
      ...(d.roundOff ? [['Round off', f(d.roundOff)]] : [])
    ], 'Total payable', d.grand)}
    ${signature()}`));
}

/** A4 salary slip. Salary carries no GST. */
export function printSalarySlip(d) {
  const row = (k, v, strong) => `<tr><td>${strong ? `<b>${k}</b>` : k}</td><td class="r">${strong ? `<b>${f(v)}</b>` : f(v)}</td></tr>`;
  printA4(letterhead(`
    <h1 class="lh-title">Salary Slip — ${esc(d.month)}</h1>
    <div class="lh-meta">
      <div class="lh-box"><span class="lh-k">Employee</span><b>${esc(d.name)}</b><br>Role: ${esc(d.role)}</div>
      <div class="lh-box r"><span class="lh-k">Slip details</span>Slip no: <b>${esc(d.no)}</b><br>Date: ${esc(d.date)}<br>Days present: ${esc(d.present)} of ${esc(d.days)}</div>
    </div>
    <table class="lh-t">
      <thead><tr><th>Description</th><th class="r">Amount (₹)</th></tr></thead>
      <tbody>
        ${row('Monthly salary', d.salary)}
        ${row(`Salary for ${d.present} day${d.present === 1 ? '' : 's'}`, d.earned)}
        ${d.bonus ? row('Bonus / allowance', d.bonus) : ''}
        ${d.advance ? row('Less: salary advance', -d.advance) : ''}
        ${d.other ? row('Less: other deduction', -d.other) : ''}
      </tbody>
      <tfoot><tr><td>Net salary payable</td><td class="r">₹${f(d.net)}</td></tr></tfoot>
    </table>
    ${signature('Employee signature')}`));
}

/** Any tabular report, printed as A4 on the letterhead. */
export function printReport({ title, date, head, rows, summary }) {
  const isNum = (c) => typeof c === 'number' || (typeof c === 'string' && /^-?[\d,]+(\.\d+)?$/.test(c.trim()) && c.trim() !== '');
  const numeric = head.map((_, i) => rows.length > 0 && rows.every((r) => r[i] === '' || r[i] == null || isNum(r[i])));
  printA4(letterhead(`
    <h1 class="lh-title">${esc(title)}</h1>
    <div class="lh-meta">
      <div class="lh-box"><span class="lh-k">Report</span><b>${esc(title)}</b><br>Business date: ${esc(date)}</div>
      <div class="lh-box r"><span class="lh-k">Printed</span>${new Date().toLocaleString('en-IN')}<br>${rows.length} row${rows.length === 1 ? '' : 's'}</div>
    </div>
    <table class="lh-t lh-small">
      <thead><tr>${head.map((h, i) => `<th class="${numeric[i] ? 'r' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${numeric[i] ? 'r' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    ${summary ? `<p class="lh-note"><b>${esc(summary)}</b></p>` : ''}`));
}

/** Download the report as a spreadsheet Excel opens directly. */
export function downloadExcel({ title, date, head, rows }) {
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
    <table border="1">
      <tr><td colspan="${head.length}"><b>Hotel Mid Town — ${esc(title)} — ${esc(date)}</b></td></tr>
      <tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
      ${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
    </table></body></html>`;

  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MidTown-${title.replace(/\s+/g, '-').toLowerCase()}-${date}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/* ------------------------------------------------------------ guest bill */

function billDocument({ title, sections, guest, room, checkIn, checkOut, no, payments, note }) {
  const live = sections.filter((s) => s.lines.length);
  const rows = live.map((s) => `
    <tr class="sec"><td colspan="4">${esc(s.title)} <span>· GST ${s.rate}%</span></td></tr>
    ${s.lines.map((l) => `<tr><td>${esc(l.d)}</td><td class="r">${esc(l.q)}</td><td class="r">${f(l.rate)}</td><td class="r">${f(l.amount)}</td></tr>`).join('')}`).join('');

  const tax = live.map((s) => `<tr><td>${esc(s.title)}</td><td class="r">${s.rate}%</td><td class="r">${f(s.taxable)}</td>
    <td class="r">${f(s.cgst)}</td><td class="r">${f(s.sgst)}</td><td class="r">${f(s.total)}</td></tr>`).join('');

  const total = live.reduce((a, s) => a + s.total, 0);
  const cgst = live.reduce((a, s) => a + s.cgst, 0);
  const sgst = live.reduce((a, s) => a + s.sgst, 0);
  const taxable = live.reduce((a, s) => a + s.taxable, 0);

  return letterhead(`
    <h1 class="lh-title">${esc(title)}</h1>
    <div class="lh-meta">
      <div class="lh-box"><span class="lh-k">Guest</span><b>${esc(guest)}</b><br>Room: ${esc(room)}</div>
      <div class="lh-box r"><span class="lh-k">Bill details</span>${no ? `Bill no: <b>${esc(no)}</b><br>` : ''}Stay: ${esc(checkIn)} to ${esc(checkOut)}<br>Printed: ${new Date().toLocaleString('en-IN')}</div>
    </div>
    <table class="lh-t">
      <thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="lh-t lh-small">
      <thead><tr><th>Tax summary</th><th class="r">GST</th><th class="r">Taxable</th><th class="r">CGST</th><th class="r">SGST</th><th class="r">Total</th></tr></thead>
      <tbody>${tax}</tbody>
      <tfoot><tr><td>Total</td><td></td><td class="r">${f(taxable)}</td><td class="r">${f(cgst)}</td><td class="r">${f(sgst)}</td><td class="r">${f(total)}</td></tr></tfoot>
    </table>
    ${totalsBox([], 'Amount payable', total)}
    ${payments?.length ? `<p class="lh-note">Paid by: ${payments.map((p) => `${esc(p.mode)} ₹${f(p.amount)}`).join(' · ')}</p>` : ''}
    ${note ? `<p class="lh-note">${esc(note)}</p>` : ''}
    ${signature('Guest signature')}
    <p class="lh-terms">Thank you for staying with us. Goods and services once supplied are not returnable. Subject to Raigarh jurisdiction.</p>`);
}

/**
 * Prints a guest bill. `which`: 'combined' | 'stay' | 'food' | 'other' | 'separate'
 * ('separate' prints one bill per non-empty section, each on its own page).
 */
export function printBill({ bill, which = 'combined', ...meta }) {
  const live = bill.sections.filter((s) => s.lines.length);
  if (!live.length) return false;
  const doc = (sections, title) => billDocument({ ...meta, sections, title });

  let sheets;
  if (which === 'separate') {
    sheets = live.map((s) => doc([s], `${s.title} bill`));
  } else if (which === 'combined') {
    sheets = [doc(live, meta.title || 'Tax invoice — combined bill')];
  } else {
    const s = bill.sections.find((x) => x.key === which);
    if (!s?.lines.length) return false;
    sheets = [doc([s], `${s.title} bill`)];
  }
  printA4(...sheets);
  return true;
}
