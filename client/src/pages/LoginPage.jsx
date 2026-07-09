import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

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
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md animate-fadeIn">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link to="/"><img src="/favicon.svg" alt="Hotline HQ" className="w-14 h-14 mb-4" style={{ filter: 'drop-shadow(0 8px 24px rgba(217,45,32,0.35))' }} /></Link>
          <h1 className="text-2xl font-bold">Hotline HQ</h1>
          <p className="hq-label mt-1">{t("login.subtitle")}</p>
        </div>

        {unverified ? (
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
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => setPassword(v => v.trim())}
                    required
                    autoComplete="current-password"
                    className="hq-input"
                    placeholder={t("login.passwordPlaceholder")}
                  />
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
    </div>
  );
}
