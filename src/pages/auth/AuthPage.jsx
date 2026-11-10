import { useState } from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isSignup = mode === 'signup';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (isSignup && !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      setError('Username must be 3-20 characters: letters, numbers, underscore.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      if (isSignup) {
        const { data, error: err } = await signUp(email.trim(), password, username.trim());
        if (err) throw err;
        if (!data.session) {
          setNotice('Account created. Check your email to confirm, then log in.');
          setMode('login');
        }
      } else {
        const { error: err } = await signIn(email.trim(), password);
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <Shield size={32} />
          <h1>WARSTATE</h1>
          <p>Global Dominion</p>
        </div>

        {isSignup && (
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
          />
        </label>

        {error && <div className="msg msg-error">{error}</div>}
        {notice && <div className="msg msg-ok">{notice}</div>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Please wait...' : isSignup ? 'Create account' : 'Log in'}
        </button>

        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setMode(isSignup ? 'login' : 'signup');
            setError('');
            setNotice('');
          }}
        >
          {isSignup ? 'Already have an account? Log in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  );
}
