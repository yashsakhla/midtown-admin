import { today, addDays, uid } from '../lib/format';

export const TARIFF = { Standard: 1800, Deluxe: 2600, Executive: 3400, Suite: 5200 };

export const MENU = [
  { n: 'Veg Thali', p: 220, c: 'Main' },
  { n: 'Non-veg Thali', p: 320, c: 'Main' },
  { n: 'Paneer Butter Masala', p: 260, c: 'Main' },
  { n: 'Chicken Curry', p: 310, c: 'Main' },
  { n: 'Dal Tadka', p: 180, c: 'Main' },
  { n: 'Veg Biryani', p: 240, c: 'Main' },
  { n: 'Butter Roti', p: 25, c: 'Bread' },
  { n: 'Tandoori Roti', p: 20, c: 'Bread' },
  { n: 'Jeera Rice', p: 150, c: 'Rice' },
  { n: 'Masala Dosa', p: 120, c: 'Snacks' },
  { n: 'Veg Pakoda', p: 110, c: 'Snacks' },
  { n: 'Green Salad', p: 90, c: 'Snacks' },
  { n: 'Masala Chai', p: 20, c: 'Beverage' },
  { n: 'Cold Drink', p: 40, c: 'Beverage' },
  { n: 'Fresh Lime Soda', p: 60, c: 'Beverage' },
  { n: 'Gulab Jamun', p: 80, c: 'Dessert' }
];

const FLOOR_PLAN = [
  [1, ['101', 'Standard'], ['102', 'Standard'], ['103', 'Deluxe'], ['104', 'Deluxe'], ['105', 'Standard'], ['106', 'Executive']],
  [2, ['201', 'Deluxe'], ['202', 'Deluxe'], ['203', 'Executive'], ['204', 'Executive'], ['205', 'Standard'], ['206', 'Deluxe']],
  [3, ['301', 'Executive'], ['302', 'Suite'], ['303', 'Suite'], ['304', 'Deluxe'], ['305', 'Executive'], ['306', 'Standard']]
];

const IN_HOUSE = [
  ['102', 'Ramesh Sahu', '9827011234', 'CG04 KJ 8821', 2],
  ['104', 'Anita Verma', '9098776541', '—', 1],
  ['203', 'Farhan Qureshi', '9876500991', 'CG12 AB 1190', 3],
  ['302', 'Deepak Agrawal', '9425511200', 'CG07 MM 4432', 2],
  ['205', 'Sunita Yadav', '7898123400', '—', 1]
];

/**
 * Builds the starting data set. Replace this with an API call when a
 * backend is connected — the shape returned here is the shape the app uses.
 */
export function createInitialState() {
  const date = today();

  const rooms = [];
  FLOOR_PLAN.forEach((floorRow) => {
    const floor = floorRow[0];
    floorRow.slice(1).forEach(([no, type]) => {
      rooms.push({
        no, floor, type,
        status: 'vacant',
        guest: null, phone: '', vehicle: '',
        checkIn: '', checkOut: '', nights: 1,
        rate: TARIFF[type],
        folio: 0
      });
    });
  });

  IN_HOUSE.forEach(([no, guest, phone, vehicle, nights]) => {
    const r = rooms.find((x) => x.no === no);
    Object.assign(r, {
      status: 'occupied',
      guest, phone, vehicle,
      checkIn: date,
      checkOut: addDays(date, nights),
      nights,
      folio: r.rate * nights
    });
  });
  ['106', '304'].forEach((no) => { rooms.find((x) => x.no === no).status = 'dirty'; });
  rooms.find((x) => x.no === '306').status = 'ooo';

  const entries = [
    { id: uid('E'), time: '08:12', room: '102', guest: 'Ramesh Sahu', phone: '9827011234', vehicle: 'CG04 KJ 8821', type: 'Check-in', mode: 'UPI', dc: 'credit', amount: 5200, narration: 'Advance 2 nights' },
    { id: uid('E'), time: '09:40', room: '104', guest: 'Anita Verma', phone: '9098776541', vehicle: '—', type: 'Check-in', mode: 'Card', dc: 'credit', amount: 2600, narration: 'Full payment' },
    { id: uid('E'), time: '12:30', room: '106', guest: 'Vikas Patel', phone: '9300112233', vehicle: 'CG04 PL 2211', type: 'Check-out', mode: 'Cash', dc: 'credit', amount: 1800, narration: 'Settled' },
    { id: uid('E'), time: '13:15', room: '302', guest: 'Deepak Agrawal', phone: '9425511200', vehicle: 'CG07 MM 4432', type: 'Advance', mode: 'Cash', dc: 'credit', amount: 4000, narration: 'Suite advance' }
  ];

  const cash = {
    opening: 12450,
    txns: [
      { id: uid('C'), head: 'Room receipt', mode: 'UPI', dc: 'credit', amount: 5200, narration: 'Room 102' },
      { id: uid('C'), head: 'Room receipt', mode: 'Card', dc: 'credit', amount: 2600, narration: 'Room 104' },
      { id: uid('C'), head: 'Room receipt', mode: 'Bank', dc: 'credit', amount: 6000, narration: 'Room 203' },
      { id: uid('C'), head: 'Room receipt', mode: 'Cash', dc: 'credit', amount: 1800, narration: 'Room 106' },
      { id: uid('C'), head: 'Advance', mode: 'Cash', dc: 'credit', amount: 4000, narration: 'Room 302' },
      { id: uid('C'), head: 'Restaurant', mode: 'UPI', dc: 'credit', amount: 1340, narration: 'Table 4' },
      { id: uid('C'), head: 'Refund', mode: 'Cash', dc: 'debit', amount: 900, narration: 'Room 205 early checkout' },
      { id: uid('C'), head: 'Expense', mode: 'Cash', dc: 'debit', amount: 640, narration: 'Vegetables' }
    ]
  };

  const bookings = [
    { id: uid('B'), src: 'MakeMyTrip', ref: 'MMT8841902', guest: 'Nikhil Sharma', phone: '9822001122', type: 'Deluxe', rooms: 1, inD: date, pax: 2, amount: 2600, pay: 'Prepaid', status: 'Arriving' },
    { id: uid('B'), src: 'Booking.com', ref: 'BDC5510334', guest: 'Sarah Thomas', phone: '9911223344', type: 'Executive', rooms: 1, inD: date, pax: 1, amount: 3400, pay: 'Pay at hotel', status: 'Arriving' },
    { id: uid('B'), src: 'Goibibo', ref: 'GIB220981', guest: 'Manoj Kumar', phone: '9425667788', type: 'Standard', rooms: 2, inD: date, pax: 4, amount: 3600, pay: 'Prepaid', status: 'Confirmed' },
    { id: uid('B'), src: 'Agoda', ref: 'AGD771221', guest: 'Rohit Nair', phone: '9765412300', type: 'Deluxe', rooms: 1, inD: date, pax: 2, amount: 2600, pay: 'Prepaid', status: 'Cancelled' }
  ];

  const online = [
    { id: uid('O'), plat: 'Zomato', oid: 'ZOM-77412', items: '2× Paneer Butter Masala, 4 Roti', amount: 640, status: 'Preparing', time: '19:42', payout: 512 },
    { id: uid('O'), plat: 'Swiggy', oid: 'SWG-11238', items: '1× Veg Biryani, Raita', amount: 320, status: 'Picked up', time: '19:20', payout: 256 },
    { id: uid('O'), plat: 'Zomato', oid: 'ZOM-77380', items: '3× Chicken Curry, 6 Roti', amount: 980, status: 'Delivered', time: '18:55', payout: 784 }
  ];

  const stock = [
    { item: 'Bath towel', cat: 'Linen', unit: 'pcs', qty: 48, min: 40, rate: 180 },
    { item: 'Bed sheet', cat: 'Linen', unit: 'pcs', qty: 32, min: 40, rate: 420 },
    { item: 'Toiletry kit', cat: 'Amenities', unit: 'kit', qty: 120, min: 60, rate: 35 },
    { item: 'Mineral water 1L', cat: 'Beverage', unit: 'btl', qty: 24, min: 48, rate: 14 },
    { item: 'Basmati rice', cat: 'Kitchen', unit: 'kg', qty: 55, min: 25, rate: 96 },
    { item: 'Refined oil', cat: 'Kitchen', unit: 'ltr', qty: 18, min: 20, rate: 142 },
    { item: 'LPG cylinder', cat: 'Kitchen', unit: 'cyl', qty: 3, min: 2, rate: 1810 },
    { item: 'Floor cleaner', cat: 'Housekeeping', unit: 'ltr', qty: 12, min: 10, rate: 88 }
  ];

  const staff = [
    { id: 't1', name: 'Suresh Kumar', role: 'Front desk', shift: 'Morning', salary: 18000 },
    { id: 't2', name: 'Meena Sahu', role: 'Housekeeping', shift: 'Morning', salary: 12000 },
    { id: 't3', name: 'Imran Khan', role: 'Chef', shift: 'General', salary: 26000 },
    { id: 't4', name: 'Ravi Nishad', role: 'Waiter', shift: 'Evening', salary: 11000 },
    { id: 't5', name: 'Ganesh Rao', role: 'Security', shift: 'Night', salary: 13000 },
    { id: 't6', name: 'Pooja Sinha', role: 'Cashier', shift: 'Evening', salary: 16000 }
  ];

  const att = {};
  staff.forEach((s, i) => { att[s.id] = i === 4 ? 'L' : i === 3 ? 'A' : 'P'; });

  const expenses = [
    { id: uid('X'), head: 'Kitchen purchase', vendor: 'Sabzi Mandi', mode: 'Cash', amount: 640, narration: 'Daily vegetables' },
    { id: uid('X'), head: 'Laundry', vendor: 'Sparkle Dry Clean', mode: 'UPI', amount: 1450, narration: 'Linen 60 pcs' },
    { id: uid('X'), head: 'Maintenance', vendor: 'Local plumber', mode: 'Cash', amount: 850, narration: 'Room 304 geyser' }
  ];

  const kots = [
    { id: uid('K'), room: '203', items: [{ n: 'Veg Thali', q: 2, p: 220 }], time: '20:10', status: 'Served' }
  ];

  return { date, tariff: { ...TARIFF }, rooms, entries, cash, bookings, online, stock, staff, att, expenses, kots, invoices: [] };
}
