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
    if (verified === 'success') setMessage('Email verified successfully! You can now log in.');
    else if (verified === 'error') setError(msg ? decodeURIComponent(msg.replace(/\+/g, ' ')) : 'Verification failed');
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await login(email, password);
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--red)', boxShadow: '0 8px 24px -8px rgba(217,45,32,0.5)' }}>
            <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.2 5.8 7.8 8.2c-.9.9-1.2 2.3-.8 3.5 2.3 7.1 7.9 12.7 15 15 .6.2 1.2.2 1.8.1.7-.1 1.3-.4 1.7-.9l2.5-2.4c.8-.8.8-2.2 0-3l-3.2-3.2c-.7-.7-1.9-.8-2.7-.2l-2.5 1.8c-2.8-1.4-5.1-3.7-6.5-6.5l1.8-2.5c.6-.8.5-2-.2-2.7l-3.2-3.2c-.9-.8-2.3-.8-3.1 0Z" />
              <path d="M20.5 5.2c3 .9 5.4 3.3 6.3 6.3" />
              <path d="M20.8 10.2c1.2.4 2.1 1.3 2.5 2.5" />
            </svg>
          </div>
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
                required
                autoFocus
                className="hq-input"
                placeholder="you@company.com"
              />
            </div>

            <div className="mb-6">
              <label className="hq-label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="hq-input"
                placeholder="Enter your password"
              />
            </div>

            <button type="submit" disabled={loading} className="hq-btn w-full py-3">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-xs font-medium" style={{ color: 'var(--red)' }}>
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Don't have an account? </span>
          <Link to="/signup" className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
