/** Inventory: the unit an item is counted in, and its categories. */

export const STOCK_UNITS = [
  ['kg', 'Kilogram (kg)'], ['g', 'Gram (g)'], ['litre', 'Litre'], ['ml', 'Millilitre (ml)'],
  ['qty', 'Quantity (qty)'], ['pcs', 'Pieces (pcs)'], ['box', 'Box'], ['packet', 'Packet'], ['dozen', 'Dozen'],
  ['bottle', 'Bottle'], ['bag', 'Bag'], ['carton', 'Carton'], ['can', 'Can'], ['roll', 'Roll'],
  ['set', 'Set'], ['pair', 'Pair'], ['metre', 'Metre']
];

export const STOCK_CATEGORIES = ['Kitchen', 'Housekeeping', 'Laundry', 'Bar', 'Maintenance', 'General'];

/** The list to show in a dropdown: the standard units plus whatever the item already uses. */
export const unitOptions = (current) =>
  STOCK_UNITS.some(([u]) => u === current) || !current ? STOCK_UNITS : [...STOCK_UNITS, [current, current]];
