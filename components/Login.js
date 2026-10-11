'use client';

// The login page: log in, create an account, or carry on as a guest.
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const COPY = {
  login: { title: 'Welcome back', lead: 'Log in to pick up where you left off.', button: 'Log in', sign: 'Welcome back', other: 'New here?', switchTo: 'Create an account' },
  signup: { title: 'Create your account', lead: 'It takes an email and a password. Nothing else.', button: 'Create account', sign: 'Nice to meet you', other: 'Already have an account?', switchTo: 'Log in' },
};

export default function Login({ available, onDone, onGuest, onHome }) {
  const still = useReducedMotion();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const copy = COPY[mode];
  const float = still ? {} : { animate: { y: [0, -12, 0] }, transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } };

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
      onDone(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  }

  return (
    <div className="home">
      <header className="home-nav">
        <button className="home-brand as-link" onClick={onHome}>TradeWinds</button>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={onGuest}>Continue as guest</button>
      </header>

      <section className="login">
        <div className="login-card">
          <h1>{copy.title}</h1>
          <p className="muted">{copy.lead}</p>

          {available === false && (
            <p className="notice" style={{ marginTop: 16 }}>Accounts are not set up on this server yet. You can still use everything as a guest.</p>
          )}

          <form onSubmit={submit} noValidate>
            <label className="field">
              <span>Email</span>
              <input type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="field">
              <span>Password</span>
              <span className="field-row">
                <input
                  type={shown ? 'text' : 'password'}
                  name="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                />
                <button type="button" className="chip" onClick={() => setShown(!shown)}>{shown ? 'Hide' : 'Show'}</button>
              </span>
            </label>
            {error && <p className="error small" role="alert">{error}</p>}
            <button type="submit" className="btn primary big login-submit" disabled={busy || available === false || !email || !password}>
              {busy ? 'One moment…' : copy.button}
            </button>
          </form>

          <p className="login-switch">{copy.other} <button className="as-link" onClick={switchMode}>{copy.switchTo}</button></p>
          <div className="login-or"><span>or</span></div>
          <button className="btn big login-submit" onClick={onGuest}>Continue as guest</button>
          <p className="muted small" style={{ marginTop: 14 }}>An account keeps your own history. Your portfolio stays in this browser either way.</p>
        </div>

        <motion.div className="mascot-stage" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <motion.div className="mascot" {...float}>
            <img src="/mascot.png" alt="" width={507} height={492} />
            <span className="sign">
              <strong>{copy.sign}</strong>
              <span>Into the skies, into the markets</span>
            </span>
          </motion.div>
          <div className="mascot-shadow" aria-hidden="true" />
        </motion.div>
      </section>
    </div>
  );
}
