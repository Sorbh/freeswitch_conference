import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/AuthLayout';

export default function LoginPage() {
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [resending, setResending] = useState(false);
  const [magicSending, setMagicSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    const verified = searchParams.get('verified');
    const msg = searchParams.get('msg');
    const queryEmail = searchParams.get('email') || searchParams.get('e');
    const queryPassword = searchParams.get('password') || searchParams.get('p') || searchParams.get('pwd');

    if (queryEmail) setEmail(queryEmail.trim());
    if (queryPassword) setPassword(queryPassword.trim());

    if (verified === 'success') setMessage(t("login.emailVerified"));
    else if (verified === 'error') setError(msg ? decodeURIComponent(msg.replace(/\+/g, ' ')) : t("login.verificationFailed"));
    else if (searchParams.get('session') === 'expired') setMessage(t("login.sessionExpired"));
    else if (searchParams.get('session') === 'replaced') setMessage(t("login.sessionReplaced"));
    else if (!verified && msg) setError(decodeURIComponent(msg.replace(/\+/g, ' ')));

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
    setUnverified(false);
    setDisabled(false);
    setLoading(true);
    try {
      const cleanEmail = email.trim();
      const cleanPassword = password.trim();
      setEmail(cleanEmail);
      setPassword(cleanPassword);
      await login(cleanEmail, cleanPassword);
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(true);
      } else if (err.code === 'ACCOUNT_DISABLED') {
        setDisabled(true);
      }
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
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setUnverified(false);
      setError('');
      setMessage(json.message || t("login.verificationResent"));
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  async function handleMagicLink() {
    const cleanEmail = email.trim();
    if (!cleanEmail) { setError(t("login.email") + ' is required'); return; }
    setMagicSending(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/v1/client/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setMagicSent(true);
      setMessage(json.message || 'Check your email for a login link.');
    } catch (err) {
      setError(err.message);
    } finally {
      setMagicSending(false);
    }
  }

  return (
    <AuthLayout variant="login">
      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link to="/"><img src="/favicon.svg" alt="Hotline HQ" className="w-14 h-14 mb-4" style={{ filter: 'drop-shadow(0 8px 24px rgba(217,45,32,0.35))' }} /></Link>
          <h1 className="text-2xl font-bold">Hotline HQ</h1>
          <p className="hq-label mt-1">{t("login.subtitle")}</p>
        </div>

        {disabled ? (
          <div className="hq-card p-6 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </div>
            <h2 className="text-lg font-bold mb-1">Account Disabled</h2>
            <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>Your account has been disabled by an administrator.</p>
            <p className="text-sm font-medium mb-5" style={{ color: 'var(--ink)' }}>{email}</p>

            <a
              href="https://wa.me/66917636278?text=Hi%2C%20my%20account%20has%20been%20disabled%20and%20I%20need%20help"
              target="_blank"
              rel="noopener noreferrer"
              className="hq-btn w-full py-3 mb-3 inline-flex items-center justify-center gap-2 no-underline"
              style={{ background: 'var(--red)', textDecoration: 'none', color: '#fff' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.616l4.529-1.476A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.37 0-4.567-.82-6.3-2.186l-.44-.352-2.874.937.956-2.836-.384-.463A9.95 9.95 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
              Contact Admin
            </a>

            <button
              type="button"
              onClick={() => { setDisabled(false); setError(''); }}
              className="w-full py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer' }}
            >
              Login Another Account
            </button>
          </div>
        ) : unverified ? (
          <div className="hq-card p-6 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(234,179,8,0.12)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold mb-1">{t("login.emailNotVerified")}</h2>
            <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>{t("login.emailNotVerifiedHint")}</p>
            <p className="text-sm font-medium mb-5" style={{ color: 'var(--ink)' }}>{email}</p>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="hq-btn w-full py-3 mb-3"
              style={{ background: 'var(--red)' }}
            >
              {resending ? t("login.resending") : t("login.resendVerification")}
            </button>

            <button
              type="button"
              onClick={() => { setUnverified(false); setError(''); }}
              className="w-full py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', cursor: 'pointer' }}
            >
              {t("login.tryAgain")}
            </button>
          </div>
        ) : (
          <>
            {/* Card */}
            <div className={`hq-card p-6 ${shake ? 'animate-shake' : ''}`}>
              {message && <div className="hq-alert-success">{message}</div>}
              {error && <div className="hq-alert-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="hq-label">{t("login.email")}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setEmail(v => v.trim())}
                    required
                    autoFocus
                    autoComplete="email"
                    className="hq-input"
                    placeholder={t("login.emailPlaceholder")}
                  />
                </div>

                <div className="mb-4">
                  <label className="hq-label">{t("login.password")}</label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onBlur={() => setPassword(v => v.trim())}
                      required
                      autoComplete="current-password"
                      className="hq-input"
                      style={{ paddingRight: 40 }}
                      placeholder={t("login.passwordPlaceholder")}
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                      {showPwd ? <EyeOffSvg /> : <EyeSvg />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 mb-4 text-xs" style={{ color: 'var(--muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
                  <span>{t("login.secureAccess")}</span>
                </div>

                <button type="submit" disabled={loading} className="hq-btn w-full py-3">
                  {loading ? t("login.signingIn") : t("login.signIn")}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link to="/client/forgot-password" className="text-xs font-medium" style={{ color: 'var(--red)' }}>
                  {t("login.forgotPassword")}
                </Link>
              </div>

              <div className="flex items-center gap-3 mt-5">
                <div className="flex-1 h-px" style={{ background: 'var(--line)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)', fontFamily: 'var(--mono)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'var(--line)' }} />
              </div>

              <button
                type="button"
                onClick={handleMagicLink}
                disabled={magicSending || magicSent}
                className="w-full py-3 mt-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: magicSent ? 'var(--green)' : 'var(--ink)', cursor: magicSent ? 'default' : 'pointer' }}
              >
                {magicSent ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Check your email
                  </>
                ) : magicSending ? 'Sending...' : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    Email me a login link
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 text-center">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>{t("login.noAccount")}{' '}</span>
              <Link to="/client/signup" className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
                {t("login.signUp")}
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

function EyeSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EyeOffSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}
