import { useHotel } from '../store/HotelContext';

export default function Toast() {
  const { toastMsg } = useHotel();
  return (
    <div className={`toast${toastMsg ? ' on' : ''}`} role="status" aria-live="polite">
      {toastMsg}
    </div>
  );
}
