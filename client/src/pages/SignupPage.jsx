import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster, toast } from 'sonner';

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
  const { t } = useTranslation("auth");
  const [form, setForm] = useState({ email: '', password: '', company_name: '', room: '', referral_code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [shake, setShake] = useState(false);
  const [showMoreRooms, setShowMoreRooms] = useState(false);
  const [orderedRooms, setOrderedRooms] = useState(PUBLIC_SIGNUP_ROOMS);
  const [hasUrlCompany, setHasUrlCompany] = useState(false);
  const [hasUrlRoom, setHasUrlRoom] = useState(false);
  const [companyFromUrl, setCompanyFromUrl] = useState('');
  const passwordRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || params.get('e') || '';
    const company = params.get('company_name') || params.get('company') || params.get('c') || '';
    const ref = params.get('ref') || params.get('referral_code') || '';
    const room = params.get('room') || '';
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

    if (company) {
      setHasUrlCompany(true);
      setCompanyFromUrl(company.replace(/\s*-\s*[A-Z]{2}\d{0,2}$/, '').trim());
    }
    if (requestedRoom) {
      setHasUrlRoom(true);
    }

    setForm(f => ({
      ...f,
      email,
      company_name: company,
      referral_code: ref,
      room: String(defaultRoom.id),
    }));

    if (email && company) {
      setTimeout(() => passwordRef.current?.focus(), 100);
    }
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
        email: form.email.trim(),
        password: form.password.trim(),
        company_name: form.company_name.trim(),
        room: form.room,
        referral_code: form.referral_code.trim(),
      };
      const res = await fetch('/api/v1/client/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSuccess(json.message || t("signup.accountCreated"));
    } catch (err) {
      setError(err.message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch('/api/v1/client/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success(json.message || t("signup.verificationSent"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResending(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <Toaster richColors position="top-center" />
        <div className="w-full max-w-md animate-fadeIn text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(18,183,106,0.1)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">{t("signup.checkEmail")}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{success}</p>
          <Link to="/client/login" className="hq-btn inline-block px-6 py-3">
            {t("signup.goToLogin")}
          </Link>
          <div className="mt-4">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{t("signup.didntGetIt")}{' '}</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-sm font-semibold"
              style={{
                color: 'var(--red)',
                background: 'transparent',
                border: 0,
                padding: 0,
                cursor: resending ? 'default' : 'pointer',
                opacity: resending ? 0.6 : 1,
              }}
            >
              {resending ? t("signup.sending") : t("signup.resendVerification")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md animate-fadeIn">
        <div className="flex flex-col items-center mb-6">
          <Link to="/"><img src="/favicon.svg" alt="Hotline HQ" className="w-14 h-14 mb-4" style={{ filter: 'drop-shadow(0 8px 24px rgba(217,45,32,0.35))' }} /></Link>
          {hasUrlCompany ? (
            <>
              <h1 className="text-2xl font-bold text-center" style={{ lineHeight: 1.3 }}>
                {t("signup.welcomeCompany", { company: companyFromUrl })}
              </h1>
              <p className="mt-2 text-sm text-center" style={{ color: 'var(--muted)', maxWidth: '340px', lineHeight: 1.5 }}>
                {t("signup.welcomeSubtitle")}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{t("signup.title")}</h1>
              <p className="mt-2 text-sm text-center" style={{ color: 'var(--muted)', maxWidth: '340px', lineHeight: 1.5 }}>
                {t("signup.subtitle")}
              </p>
            </>
          )}
          <div className="flex flex-wrap justify-center mt-3" style={{ gap: '6px' }}>
            {t("signup.badges", { returnObjects: true }).map(label => (
              <span key={label} style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#fff',
                background: 'var(--red)',
                borderRadius: '999px',
                padding: '4px 12px',
                letterSpacing: '0.03em',
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className={`hq-card p-6 ${shake ? 'animate-shake' : ''}`}>
          {error && <div className="hq-alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {!hasUrlCompany && (
              <div className="mb-3">
                <label htmlFor="signup-company" className="hq-label">{t("signup.companyName")}</label>
                <input id="signup-company" type="text" value={form.company_name} onChange={update('company_name')} onBlur={trimField('company_name')} required className="hq-input" placeholder={t("signup.companyPlaceholder")} />
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="signup-email" className="hq-label">{t("signup.email")}</label>
              <input
                id="signup-email"
                type="email"
                value={form.email}
                onChange={update('email')}
                onBlur={trimField('email')}
                required
                autoFocus={!hasUrlCompany}
                autoComplete="email"
                className="hq-input"
                placeholder={t("signup.emailPlaceholder")}
              />
              {form.email.length > 0 && (
                <div className="mt-2 rounded-md px-3 py-2 flex items-start gap-2 text-xs" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.35)', color: '#92400e', lineHeight: 1.4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span style={{ fontWeight: 600 }}>{t("signup.emailHint")}</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label htmlFor="signup-password" className="hq-label">{t("signup.password")}</label>
              <input
                id="signup-password"
                ref={passwordRef}
                type="password"
                value={form.password}
                onChange={update('password')}
                required
                minLength={6}
                autoComplete="new-password"
                className="hq-input"
                placeholder={t("signup.passwordPlaceholder")}
              />
            </div>

            {!hasUrlCompany && !hasUrlRoom && (
              <div className="mb-4">
                <label className="hq-label">{t("signup.startingRoom")} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t("signup.optional")}</span></label>
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
                    {showMoreRooms ? t("signup.showFewerRooms") : t("signup.showMoreRooms", { count: hiddenRoomCount })}
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="hq-btn w-full py-3">
              {loading ? t("signup.creatingAccount") : t("signup.createFreeAccount")}
            </button>

            <div className="mt-4 rounded-lg px-4 py-2.5 flex items-center justify-center gap-3" style={{
              background: 'rgba(217,45,32,0.06)',
              border: '1px solid rgba(217,45,32,0.15)',
            }}>
              <div className="offer-pulse" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded" style={{
                background: 'var(--red)',
                color: '#fff',
                letterSpacing: '0.08em',
                flexShrink: 0,
              }}>{t("signup.offer")}</span>
              <span className="text-base" style={{ color: 'var(--ink)' }}>
                {t("signup.offerText")} <span className="font-semibold" style={{ color: 'var(--red)' }}>{t("signup.offerHighlight")}</span> <span style={{ color: 'var(--muted)', fontSize: '0.65rem', verticalAlign: 'super' }}>*</span>
              </span>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>{t("signup.alreadyHaveAccount")}{' '}</span>
          <Link to="/client/login" className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
            {t("signup.signIn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
