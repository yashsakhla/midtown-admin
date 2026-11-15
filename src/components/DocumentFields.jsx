import { useEffect, useMemo } from 'react';
import { DOC_ACCEPT, DOC_TYPES, MAX_DOC_MB } from '../lib/customers';
import { useHotel } from '../store/HotelContext';
import Field, { Row2 } from './Field';

export const emptyDoc = () => ({ type: DOC_TYPES[0], number: '', file: null });

/** Document type, number and file picker (image or PDF). `value` is { type, number, file }. */
export default function DocumentFields({ value, onChange, label = 'ID document' }) {
  const { toast } = useHotel();
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });

  const pick = (e) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > MAX_DOC_MB * 1024 * 1024) {
      toast(`File is larger than ${MAX_DOC_MB} MB`);
      e.target.value = '';
      return;
    }
    onChange({ ...value, file });
  };

  const preview = useMemo(
    () => (value.file && value.file.type.startsWith('image/') ? URL.createObjectURL(value.file) : ''),
    [value.file]
  );
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div>
      <Row2>
        <Field as="select" label={`${label} type`} value={value.type} onChange={set('type')}>
          {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Field>
        <Field label="Document number" placeholder="Optional" value={value.number} onChange={set('number')} />
      </Row2>
      <Field label={`Upload ${label.toLowerCase()} (photo or PDF, up to ${MAX_DOC_MB} MB)`} type="file" accept={DOC_ACCEPT} capture="environment" onChange={pick} />
      {value.file && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '-4px 0 10px', fontSize: 12.5, color: 'var(--muted)' }}>
          {preview && <img src={preview} alt="" style={{ width: 54, height: 40, objectFit: 'cover', borderRadius: 8 }} />}
          <span>{value.file.name} · {(value.file.size / 1024).toFixed(0)} KB</span>
        </div>
      )}
    </div>
  );
}
