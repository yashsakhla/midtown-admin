/**
 * Guest bill: stay, food and other charges, each with CGST + SGST.
 * Rates below are display defaults; confirm them with your accountant.
 * If the server sends its own tax figures, prefer those.
 */

export const GST = {
  /** true: tariffs and prices already include GST, so tax is shown as a breakup and the totals do not change. */
  inclusive: true,
  roomSlabs: [{ upTo: 7500, rate: 5 }, { upTo: Infinity, rate: 18 }],   // by nightly room price
  food: 5,
  other: 18
};

export const roomGstRate = (nightly) => GST.roomSlabs.find((s) => nightly <= s.upTo).rate;

const r2 = (v) => Math.round(v * 100) / 100;

/** Splits an amount into taxable value, CGST and SGST at `rate` percent. */
export function taxSplit(amount, rate) {
  const a = Number(amount) || 0;
  const taxable = GST.inclusive ? a / (1 + rate / 100) : a;
  const tax = GST.inclusive ? a - taxable : (a * rate) / 100;
  return { taxable: r2(taxable), cgst: r2(tax / 2), sgst: r2(tax / 2), total: r2(taxable + tax) };
}

export const SECTION_TITLES = { stay: 'Room / stay', food: 'Food & room service', other: 'Other services' };

const section = (key, rate, lines) => {
  const amount = lines.reduce((s, l) => s + l.amount, 0);
  return { key, title: SECTION_TITLES[key], rate, lines, amount, ...taxSplit(amount, rate) };
};

/** Builds the three bill sections from a room's stay, its kitchen orders and priced guest requests. */
export function buildBill(room, db, rates = {}) {
  const rateOf = (key, dflt) => (rates[key] === undefined || rates[key] === '' ? dflt : Number(rates[key]) || 0);
  const nights = room.nights || 1;
  const stayLines = room.roomCharges?.length
    ? room.roomCharges.map((c) => ({ d: c.label, q: 1, rate: c.amount, amount: c.amount }))
    : [
      {
        d: `Room ${room.no} — ${room.type}, ${room.guests > 2 ? `${room.guests} guests` : room.guests === 2 ? 'double' : 'single'}`,
        q: nights, rate: room.stayRate, amount: room.stayRate * nights
      },
      ...room.shifts.filter((s) => s.adjustment).map((s) => ({
        d: `Room shift ${s.from} → ${s.to} (${s.kind || 'change'})`, q: 1, rate: s.adjustment, amount: s.adjustment
      }))
    ];

  const foodLines = db.kots.filter((k) => k.status !== 'Cancelled' && (k.stayId ? k.stayId === room.stayId : k.room === room.no))
    .flatMap((k) => k.items.map((i) => ({ d: `${i.n} (${k.time})`, q: i.q, rate: i.p, amount: i.q * i.p })));

  const otherLines = db.requests
    .filter((r) => r.stayId === room.stayId && r.price > 0 && r.status === 'DONE')
    .map((r) => ({ d: r.label, q: 1, rate: r.price, amount: r.price }));

  const sections = [
    section('stay', rateOf('stay', roomGstRate(room.stayRate)), stayLines),
    section('food', rateOf('food', GST.food), foodLines),
    section('other', rateOf('other', GST.other), otherLines)
  ];
  const sum = (k) => r2(sections.reduce((s, x) => s + x[k], 0));
  return { sections, amount: sum('amount'), taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), total: sum('total') };
}

/**
 * Print-only bill: the manager overrides each section's amount. Nothing here is posted
 * or saved to the folio, day book or reports.
 */
export function manualBill(bill, amounts, rates = {}) {
  const sections = bill.sections.map((s) => {
    const amount = Number(amounts[s.key]) || 0;
    const rate = rates[s.key] === undefined || rates[s.key] === '' ? s.rate : Number(rates[s.key]) || 0;
    const lines = amount ? [{ d: SECTION_TITLES[s.key], q: 1, rate: amount, amount }] : [];
    // The typed amount is the value BEFORE tax: GST is added on top of it.
    const tax = r2((amount * rate) / 100);
    return { ...s, rate, lines, amount, taxable: r2(amount), cgst: r2(tax / 2), sgst: r2(tax / 2), total: r2(amount + tax) };
  });
  const sum = (k) => r2(sections.reduce((s, x) => s + x[k], 0));
  return { sections, amount: sum('amount'), taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), total: sum('total') };
}
