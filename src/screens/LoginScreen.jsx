import { useState } from 'react';
import { useHotel } from '../store/HotelContext';

export default function LoginScreen() {
  const { signIn } = useHotel();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(identifier.trim(), password);
    } catch (err) {
      setError(err.status === 401 ? 'Invalid credentials' : err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark" aria-hidden="true">&#10052;</div>
        <h1>The Midtown Hotel</h1>
        <p>Sign in to the manager app</p>

        <div className="f">
          <label htmlFor="li-id">Phone or email</label>
          <input id="li-id" autoComplete="username" value={identifier}
            onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div className="f">
          <label htmlFor="li-pw">Password</label>
          <input id="li-pw" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {error && <div className="login-err" role="alert">{error}</div>}
        <button className="btn p" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
