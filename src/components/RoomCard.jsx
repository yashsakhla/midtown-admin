import { ROOM_ART } from '../assets';
import { money } from '../lib/format';
import { CalendarIcon, StatusBadgeIcon } from './Icons';

export const roomLabel = (r) =>
  r.status === 'vacant' ? 'Ready'
    : r.status === 'occupied' ? (r.guest || 'Occupied')
      : r.status === 'dirty' ? 'Needs cleaning'
        : 'Out of order';

/** Illustrated room tile — colour, badge and bed art follow the status. */
export default function RoomCard({ room, onClick }) {
  const label = roomLabel(room);

  return (
    <button className={`room ${room.status}`} onClick={() => onClick(room.no)} title={label}>
      <div className="badge"><StatusBadgeIcon status={room.status} /></div>

      <div className="txt">
        <div className="rn">{room.no}</div>
        <div className="rt">{room.type}</div>
        <div className="rp">{money(room.rate)}</div>
        {room.checkOut && (
          <div className="rd"><CalendarIcon />Till {room.checkOut}</div>
        )}
        <div className="rs"><i />
          <span>{label}</span>
        </div>
      </div>

      <img className="art" src={ROOM_ART[room.status] || ROOM_ART.vacant} alt="" />
    </button>
  );
}

/** Dashed tile that opens the add-room sheet for a floor. */
export function AddRoomCard({ onClick }) {
  return (
    <button className="room add" onClick={onClick}>
      <div className="plus">+</div>
      <div className="lbl">Add room</div>
    </button>
  );
}
