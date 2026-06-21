import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', company_name: '', display_name: '', company_phone: '', city: '', zip: '', room: '' });
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    fetch('/api/v1/client/rooms')
      .then(r => r.json())
      .then(json => { if (json.data) setRooms(json.data); })
      .catch(() => {});
  }, []);

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/client/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSuccess(json.message || 'Account created! Check your email to verify.');
      setForm({ email: '', password: '', company_name: '', display_name: '', company_phone: '', city: '', zip: '', room: '' });
    } catch (err) {
      setError(err.message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md animate-fadeIn text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(18,183,106,0.1)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Check Your Email</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{success}</p>
          <Link to="/client/login" className="hq-btn inline-block px-6 py-3">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src="/favicon.svg" alt="Hotline HQ" className="w-14 h-14 mb-4" style={{ filter: 'drop-shadow(0 8px 24px rgba(217,45,32,0.35))' }} />
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="hq-label mt-1">Join Hotline HQ</p>
        </div>

        {/* Card */}
        <div className={`hq-card p-6 ${shake ? 'animate-shake' : ''}`}>
          {error && <div className="hq-alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="hq-label">Company Name</label>
                <input type="text" value={form.company_name} onChange={update('company_name')} required className="hq-input" placeholder="Acme Auto Parts" />
              </div>
              <div>
                <label className="hq-label">Owner Name</label>
                <input type="text" value={form.display_name} onChange={update('display_name')} required className="hq-input" placeholder="John Smith" />
              </div>
            </div>

            <div className="mb-3">
              <label className="hq-label">Email</label>
              <input type="email" value={form.email} onChange={update('email')} required className="hq-input" placeholder="you@company.com" />
            </div>

            <div className="mb-3">
              <label className="hq-label">Password</label>
              <input type="password" value={form.password} onChange={update('password')} required minLength={6} className="hq-input" placeholder="At least 6 characters" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="hq-label">Phone</label>
                <input type="tel" value={form.company_phone} onChange={update('company_phone')} required className="hq-input" placeholder="(555) 555-5555" />
              </div>
              <div>
                <label className="hq-label">City</label>
                <input type="text" value={form.city} onChange={update('city')} required className="hq-input" placeholder="San Bernardino" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="hq-label">Zip Code</label>
                <input type="text" value={form.zip} onChange={update('zip')} required className="hq-input" placeholder="92407" />
              </div>
              <div>
                <label className="hq-label">Room</label>
                <select value={form.room} onChange={update('room')} required className="hq-input appearance-none" style={{ color: form.room ? 'var(--ink)' : 'var(--muted)' }}>
                  <option value="">Select a room</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading} className="hq-btn w-full py-3">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Already have an account? </span>
          <Link to="/client/login" className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
