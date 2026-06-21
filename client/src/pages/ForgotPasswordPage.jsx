import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/client/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md animate-fadeIn text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(18,183,106,0.1)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Check Your Email</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            If an account exists with <strong>{email}</strong>, we've sent a password reset link.
          </p>
          <Link to="/client/login" className="hq-btn inline-block px-6 py-3">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md animate-fadeIn">
        <div className="flex flex-col items-center mb-8">
          <img src="/favicon.svg" alt="Hotline HQ" className="w-14 h-14 mb-4" style={{ filter: 'drop-shadow(0 8px 24px rgba(217,45,32,0.35))' }} />
          <h1 className="text-2xl font-bold">Forgot Password</h1>
          <p className="text-sm mt-2 text-center" style={{ color: 'var(--muted)' }}>Enter your email and we'll send a reset link</p>
        </div>

        <div className="hq-card p-6">
          {error && <div className="hq-alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="hq-label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus className="hq-input" placeholder="you@company.com" />
            </div>
            <button type="submit" disabled={loading} className="hq-btn w-full py-3">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link to="/client/login" className="text-sm font-medium" style={{ color: 'var(--red)' }}>Back to login</Link>
        </div>
      </div>
    </div>
  );
}
