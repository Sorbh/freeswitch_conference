import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const verified = searchParams.get('verified');
    const msg = searchParams.get('msg');
    const queryEmail = searchParams.get('email') || searchParams.get('e');
    const queryPassword = searchParams.get('password') || searchParams.get('p') || searchParams.get('pwd');

    if (queryEmail) setEmail(queryEmail.trim());
    if (queryPassword) setPassword(queryPassword.trim());

    if (verified === 'success') setMessage('Email verified successfully! You can now log in.');
    else if (verified === 'error') setError(msg ? decodeURIComponent(msg.replace(/\+/g, ' ')) : 'Verification failed');

    if (queryEmail || queryPassword) {
      const nextParams = new URLSearchParams(searchParams);
      ['email', 'e', 'password', 'p', 'pwd'].forEach(key => nextParams.delete(key));
      const nextUrl = `${window.location.pathname}${nextParams.toString() ? `?${nextParams}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, nextUrl);
    }
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const cleanEmail = email.trim();
      const cleanPassword = password.trim();
      setEmail(cleanEmail);
      setPassword(cleanPassword);
      await login(cleanEmail, cleanPassword);
    } catch (err) {
      setError(err.message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/hotlinehq/favicon.svg" alt="Hotline HQ" className="w-14 h-14 mb-4" style={{ filter: 'drop-shadow(0 8px 24px rgba(217,45,32,0.35))' }} />
          <h1 className="text-2xl font-bold">Hotline HQ</h1>
          <p className="hq-label mt-1">Client Login</p>
        </div>

        {/* Card */}
        <div className={`hq-card p-6 ${shake ? 'animate-shake' : ''}`}>
          {message && <div className="hq-alert-success">{message}</div>}
          {error && <div className="hq-alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="hq-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setEmail(v => v.trim())}
                required
                autoFocus
                className="hq-input"
                placeholder="you@company.com"
              />
            </div>

            <div className="mb-4">
              <label className="hq-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onBlur={() => setPassword(v => v.trim())}
                required
                className="hq-input"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-center gap-2 mb-4 text-xs" style={{ color: 'var(--muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
              <span>Secure client access. No card required.</span>
            </div>

            <button type="submit" disabled={loading} className="hq-btn w-full py-3">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/client/forgot-password" className="text-xs font-medium" style={{ color: 'var(--red)' }}>
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Don't have an account? </span>
          <Link to="/client/signup" className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
