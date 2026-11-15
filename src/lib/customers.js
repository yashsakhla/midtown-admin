/** Customer identity documents. */

/** New customers must upload an ID at first check-in. Set to false to make it optional. */
export const DOC_REQUIRED = true;

export const DOC_TYPES = ['Aadhaar', 'Driving licence', 'Passport', 'Voter ID', 'PAN', 'Other'];

export const MAX_DOC_MB = 5;
export const DOC_ACCEPT = 'image/*,application/pdf';

/** Keeps only the last 4 characters of an ID number on screen. */
export const maskDoc = (num) => {
  const s = String(num || '').replace(/\s/g, '');
  return s.length > 4 ? '\u2022\u2022\u2022\u2022' + s.slice(-4) : s;
};

export const DOC_API_TYPE = {
  Aadhaar: 'AADHAAR', 'Driving licence': 'DRIVING_LICENCE', Passport: 'PASSPORT',
  'Voter ID': 'VOTER_ID', PAN: 'PAN', Other: 'OTHER'
};
