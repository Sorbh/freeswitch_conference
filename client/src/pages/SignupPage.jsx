import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const PUBLIC_SIGNUP_ROOMS = [
  { id: 123456701, name: 'California', code: 'CA' },
  { id: 123456712, name: 'Arizona', code: 'AZ' },
  { id: 123456703, name: 'Texas', code: 'TX' },
  { id: 123456704, name: 'NewJersey', code: 'NJ' },
  { id: 123456705, name: 'Florida', code: 'FL' },
  { id: 123456706, name: 'Mexico', code: 'MX' },
  { id: 123456707, name: 'Egypt', code: 'EG' },
  { id: 123456708, name: 'Spain', code: 'ES' },
  { id: 123456709, name: 'Ghana', code: 'GH' },
  { id: 123456711, name: 'SanDiego', code: 'SD' },
  { id: 123456714, name: 'Alberta', code: 'AB' },
  { id: 123456715, name: 'Canada', code: 'CA' },
  { id: 123456716, name: 'Iowa', code: 'IA' },
  { id: 123456717, name: 'Kentucky', code: 'KY' },
  { id: 123456718, name: 'Georgia', code: 'GA' },
];

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', company_name: '', display_name: '', company_phone: '', city: '', zip: '', room: '', referral_code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [showMoreRooms, setShowMoreRooms] = useState(false);
  const [orderedRooms, setOrderedRooms] = useState(PUBLIC_SIGNUP_ROOMS);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || params.get('e');
    const company = params.get('company_name') || params.get('company') || params.get('c');
    const ref = params.get('ref') || params.get('referral_code');
    const room = params.get('room');
    const roomLower = room ? String(room).toLowerCase() : '';
    const requestedRoom = room && PUBLIC_SIGNUP_ROOMS.find(item => (
      String(item.id) === roomLower ||
      item.name.toLowerCase() === roomLower ||
      item.code.toLowerCase() === roomLower
    ));
    const defaultRoom = requestedRoom || PUBLIC_SIGNUP_ROOMS[0];
    if (requestedRoom) {
      setOrderedRooms([requestedRoom, ...PUBLIC_SIGNUP_ROOMS.filter(r => r.id !== requestedRoom.id)]);
    }
    setForm(f => ({
      ...f,
      ...(email ? { email } : {}),
      ...(company ? { company_name: company } : {}),
      ...(ref ? { referral_code: ref } : {}),
      room: String(defaultRoom.id),
    }));
  }, []);

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  function trimField(field) {
    return () => setForm(f => ({ ...f, [field]: String(f[field] || '').trim() }));
  }

  function selectRoom(roomId) {
    setForm(f => ({ ...f, room: String(f.room) === String(roomId) ? '' : String(roomId) }));
  }

  function roomLabel(room) {
    return room.name.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  const PRIMARY_ROOM_COUNT = 3;
  const visibleRooms = showMoreRooms ? orderedRooms : orderedRooms.slice(0, PRIMARY_ROOM_COUNT);
  const hiddenRoomCount = orderedRooms.length - PRIMARY_ROOM_COUNT;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        email: form.email.trim(),
        password: form.password.trim(),
        company_name: form.company_name.trim(),
        referral_code: form.referral_code.trim(),
      };
      setForm(payload);
      const res = await fetch('/api/v1/client/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSuccess(json.message || 'Account created! Check your email to verify.');
      setForm({ email: '', password: '', company_name: '', display_name: '', company_phone: '', city: '', zip: '', room: '', referral_code: '' });
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
          <img src="/hotlinehq/favicon.svg" alt="Hotline HQ" className="w-14 h-14 mb-4" style={{ filter: 'drop-shadow(0 8px 24px rgba(217,45,32,0.35))' }} />
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="hq-label mt-1">Join Hotline HQ</p>
        </div>

        {/* Card */}
        <div className={`hq-card p-6 ${shake ? 'animate-shake' : ''}`}>
          {error && <div className="hq-alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="hq-label">Company Name</label>
              <input type="text" value={form.company_name} onChange={update('company_name')} onBlur={trimField('company_name')} required className="hq-input" placeholder="Acme Auto Parts" />
            </div>

            <div className="mb-3">
              <label className="hq-label">Email</label>
              <input type="email" value={form.email} onChange={update('email')} onBlur={trimField('email')} required className="hq-input" placeholder="you@company.com" />
            </div>

            <div className="mb-3">
              <label className="hq-label">Password</label>
              <input type="password" value={form.password} onChange={update('password')} onBlur={trimField('password')} required minLength={6} className="hq-input" placeholder="At least 6 characters" />
            </div>

            <div className="mb-4">
              <label className="hq-label">Starting Room <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
              <div className="flex flex-wrap gap-2 mt-2">
                {visibleRooms.map(room => {
                  const selected = String(form.room) === String(room.id);
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => selectRoom(room.id)}
                      className="px-4 py-2 rounded-lg text-sm font-normal"
                      style={{
                        background: selected ? 'var(--red-soft)' : 'var(--surface)',
                        border: selected ? '1px solid var(--red)' : '1px solid var(--line)',
                        color: selected ? 'var(--red)' : 'var(--ink)',
                        boxShadow: selected ? '0 8px 20px rgba(217,45,32,0.12)' : 'none',
                      }}
                    >
                      {roomLabel(room)}
                    </button>
                  );
                })}
              </div>
              {hiddenRoomCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMoreRooms(v => !v)}
                  className="mt-2 text-xs font-medium"
                  style={{
                    color: 'var(--red)',
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  {showMoreRooms ? 'Show fewer rooms' : `Show ${hiddenRoomCount} more rooms`}
                </button>
              )}
            </div>

            <div className="mb-4">
              <label className="hq-label">Referral Code <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
              <input type="text" value={form.referral_code} onChange={update('referral_code')} onBlur={trimField('referral_code')} className="hq-input" placeholder="e.g. A7K2M9" maxLength={6} style={{ textTransform: 'uppercase' }} />
            </div>

            <div className="flex items-center justify-center gap-2 mb-4 text-sm" style={{ color: 'var(--muted)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
              <span className="text-base font-medium">Free signup. No card required.</span>
            </div>

            <button type="submit" disabled={loading} className="hq-btn w-full py-3">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <div className="signup-offer mt-4 rounded-lg px-4 py-2.5 flex items-center justify-center gap-3" style={{
              background: 'rgba(217,45,32,0.06)',
              border: '1px solid rgba(217,45,32,0.15)',
            }}>
              <div className="offer-pulse" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded" style={{
                background: 'var(--red)',
                color: '#fff',
                letterSpacing: '0.08em',
                flexShrink: 0,
              }}>Offer</span>
              <span className="text-base" style={{ color: 'var(--ink)' }}>
                Signup and get a <span className="font-semibold" style={{ color: 'var(--red)' }}>free website</span> <span style={{ color: 'var(--muted)', fontSize: '0.65rem', verticalAlign: 'super' }}>*</span>
              </span>
            </div>
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
