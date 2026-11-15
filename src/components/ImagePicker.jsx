import { useEffect, useMemo } from 'react';
import { useHotel } from '../store/HotelContext';

export const MAX_IMAGE_MB = 5;

const thumb = { width: 72, height: 72, objectFit: 'cover', borderRadius: 10, display: 'block' };
const xBtn = {
  position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: 0, cursor: 'pointer',
  background: 'var(--red)', color: '#fff', fontSize: 12, lineHeight: '22px', padding: 0
};

/**
 * Photo picker. `files` are new File objects, `existing` are already-saved images ({ id, url }).
 * Pass `multiple` to allow several photos; otherwise a new pick replaces the previous one.
 */
export default function ImagePicker({
  label = 'Photos', files, onChange, existing = [], onRemoveExisting, multiple = true
}) {
  const { toast } = useHotel();

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const pick = (e) => {
    const picked = [...(e.target.files || [])].filter((f) => {
      if (!f.type.startsWith('image/')) { toast(`${f.name} is not an image`); return false; }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) { toast(`${f.name} is larger than ${MAX_IMAGE_MB} MB`); return false; }
      return true;
    });
    e.target.value = '';
    if (picked.length) onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
  };

  return (
    <div className="f">
      <label>{label}{multiple ? ' (you can add several)' : ''}</label>
      {(existing.length > 0 || files.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '4px 0 10px' }}>
          {existing.map((img) => (
            <div key={img.id} style={{ position: 'relative' }}>
              <img src={img.url} alt="" style={thumb} />
              {onRemoveExisting && <button type="button" aria-label="Remove photo" style={xBtn} onClick={() => onRemoveExisting(img)}>✕</button>}
            </div>
          ))}
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} style={{ position: 'relative' }}>
              <img src={previews[i]} alt="" style={thumb} />
              <button type="button" aria-label="Remove photo" style={xBtn} onClick={() => onChange(files.filter((_, n) => n !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <input type="file" accept="image/*" multiple={multiple} onChange={pick} />
    </div>
  );
}
