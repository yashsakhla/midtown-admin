/** Laundry price list, services and the order flow. Rates are defaults; each order line can override its rate. */

export const LAUNDRY_ITEMS = [
  { n: 'Shirt', wash: 20, iron: 8, dry: 80 },
  { n: 'T-shirt', wash: 18, iron: 8, dry: 70 },
  { n: 'Trouser / Jeans', wash: 25, iron: 10, dry: 90 },
  { n: 'Kurta / Pyjama', wash: 25, iron: 10, dry: 90 },
  { n: 'Saree', wash: 50, iron: 20, dry: 180 },
  { n: 'Suit / Blazer', wash: 0, iron: 30, dry: 250 },
  { n: 'Jacket', wash: 60, iron: 25, dry: 220 },
  { n: 'Bedsheet', wash: 40, iron: 15, dry: 150 },
  { n: 'Towel', wash: 20, iron: 0, dry: 0 },
  { n: 'Other', wash: 0, iron: 0, dry: 0 }
];

export const LAUNDRY_SERVICES = [
  ['WASH', 'Wash & fold'], ['IRON', 'Iron only'], ['WASH_IRON', 'Wash & iron'], ['DRY_CLEAN', 'Dry clean']
];
export const serviceLabel = (code) => (LAUNDRY_SERVICES.find(([c]) => c === code) || [, code])[1];

export const laundryRate = (item, service) => {
  const i = LAUNDRY_ITEMS.find((x) => x.n === item);
  if (!i) return 0;
  return service === 'WASH' ? i.wash : service === 'IRON' ? i.iron : service === 'WASH_IRON' ? i.wash + i.iron : i.dry;
};

/** Extra charged on the whole order for same-day service. */
export const EXPRESS_PCT = 50;

export const laundryTotals = (lines, express) => {
  const sub = lines.reduce((t, l) => t + (Number(l.q) || 0) * (Number(l.p) || 0), 0);
  const extra = express ? Math.round((sub * EXPRESS_PCT) / 100) : 0;
  return { sub, extra, total: sub + extra };
};

/** Requested -> Picked up -> In process -> Ready -> Delivered (or Cancelled at any time before delivery). */
export const LAUNDRY_FLOW = ['Requested', 'Picked up', 'In process', 'Ready', 'Delivered'];
export const LAUNDRY_NEXT = { Requested: 'Picked up', 'Picked up': 'In process', 'In process': 'Ready', Ready: 'Delivered' };
export const LAUNDRY_TONE = { Requested: 'o', 'Picked up': 'b', 'In process': 'b', Ready: 'g', Delivered: 'n', Cancelled: 'r' };
export const LAUNDRY_ACTION = {
  'Picked up': 'Mark picked up', 'In process': 'Start washing', Ready: 'Mark ready', Delivered: 'Mark delivered'
};

/** Is this guest service request a laundry request? */
export const isLaundryRequest = (r) => String(r?.key || r?.label || '').toLowerCase().includes('laundry');
