/** Guest request types and the extras that go with each one. */

/**
 * The backend currently accepts only { status } with SENT | IN_PROGRESS | DONE.
 * Flip this to true once it also accepts REJECTED, remark and price.
 */
export const REQUEST_EXTRAS = false;

export const REQUEST_STATUS = {
  SENT: { label: 'New', tone: 'o' },
  IN_PROGRESS: { label: 'In progress', tone: 'b' },
  DONE: { label: 'Completed', tone: 'g' },
  REJECTED: { label: 'Rejected', tone: 'r' },
  EXPIRED: { label: 'Expired', tone: 'n' }
};

const base = {
  icon: '🛎️', chargeable: false, hint: '',
  remarks: {
    IN_PROGRESS: ['Staff on the way', 'Will be done shortly'],
    DONE: ['Done as requested'],
    REJECTED: ['Not available right now', 'Please call the front desk']
  }
};

export const REQUEST_TYPES = {
  housekeeping: {
    ...base, icon: '🧹', label: 'Housekeeping', hint: 'Room cleaning, towels, linen, amenities',
    remarks: {
      IN_PROGRESS: ['Housekeeping is on the way', 'Will be there in 10 minutes'],
      DONE: ['Towels delivered', 'Room cleaned', 'Amenities replaced'],
      REJECTED: ['Item out of stock', 'Guest not in room']
    }
  },
  laundry: {
    ...base, icon: '👕', label: 'Laundry pickup', chargeable: true, hint: 'Pickup, wash and return — usually charged per piece',
    remarks: {
      IN_PROGRESS: ['Clothes picked up', 'Sent to laundry'],
      DONE: ['Delivered back to room', 'Charges added to folio'],
      REJECTED: ['Laundry closed for today', 'Express service not available']
    }
  },
  wifi: {
    ...base, icon: '📶', label: 'Wi-Fi help', hint: 'Connection or password problem',
    remarks: {
      IN_PROGRESS: ['Technician checking the router', 'Password being reset'],
      DONE: ['Connection restored', 'New password shared'],
      REJECTED: ['Network down — fix in progress']
    }
  },
  taxi: {
    ...base, icon: '🚕', label: 'Book taxi', chargeable: true, hint: 'Pickup time and destination are in the guest note',
    remarks: {
      IN_PROGRESS: ['Taxi being arranged', 'Driver assigned'],
      DONE: ['Taxi booked — driver will call the guest', 'Trip completed, fare added to folio'],
      REJECTED: ['No taxi available at that time']
    }
  },
  frontdesk: {
    ...base, icon: '📞', label: 'Call front desk', hint: 'Guest wants a call back or to speak to staff',
    remarks: {
      IN_PROGRESS: ['Calling the guest now'],
      DONE: ['Guest called back and helped', 'Spoke to the guest in person'],
      REJECTED: ['Guest unreachable']
    }
  },
  roomshift: {
    ...base, icon: '🔁', label: 'Room shift request', hint: 'Guest wants to move to another room: approve to pick the room and adjust the price',
    remarks: {
      IN_PROGRESS: ['Checking availability'],
      DONE: ['Shifted to the new room'],
      REJECTED: ['No suitable room available']
    }
  },
  checkout: {
    ...base, icon: '🧳', label: 'Checkout request', hint: 'Guest wants to check out — settle the bill',
    remarks: {
      IN_PROGRESS: ['Bill being prepared'],
      DONE: ['Bill settled and checked out'],
      REJECTED: ['Pending dues']
    }
  }
};

/** Looks up a type by the backend key; unknown keys still render sensibly. */
export const requestType = (key, label) => {
  const k = String(key || '').toLowerCase().replace(/[\s_-]+/g, '');
  const hit = Object.entries(REQUEST_TYPES).find(([id]) => k.includes(id));
  return hit ? hit[1] : { ...base, label: label || key || 'Request' };
};
