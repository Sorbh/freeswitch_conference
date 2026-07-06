import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError(t("reset.passwordsDoNotMatch")); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/client/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md text-center animate-fadeIn">
          <h2 className="text-xl font-bold mb-3">{t("reset.invalidLink")}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{t("reset.invalidLinkMessage")}</p>
          <Link to="/client/forgot-password" className="text-sm font-semibold" style={{ color: 'var(--red)' }}>{t("reset.requestNewLink")}</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(18,183,106,0.1)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">{t("reset.successTitle")}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{t("reset.successMessage")}</p>
          <Link to="/client/login" className="hq-btn inline-block px-6 py-3">{t("reset.goToLogin")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md animate-fadeIn">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold">{t("reset.title")}</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{t("reset.subtitle")}</p>
        </div>
        <div className="hq-card p-6">
          {error && <div className="hq-alert-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="hq-label">{t("reset.newPassword")}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoFocus className="hq-input" placeholder={t("reset.passwordPlaceholder")} />
            </div>
            <div className="mb-6">
              <label className="hq-label">{t("reset.confirmPassword")}</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} className="hq-input" placeholder={t("reset.confirmPlaceholder")} />
            </div>
            <button type="submit" disabled={loading} className="hq-btn w-full py-3">
              {loading ? t("reset.resetting") : t("reset.resetButton")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
