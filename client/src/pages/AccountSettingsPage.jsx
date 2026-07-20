import { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { isGestureEnabled, setGestureEnabled } from '../hooks/useGestureControl';

function PrefToggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-2" style={{ cursor: 'pointer' }}>
      <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={e => { e.preventDefault(); onChange(!checked); }}
        style={{
          width: 40, height: 22, borderRadius: 11, position: 'relative', flexShrink: 0,
          background: checked ? 'var(--green)' : 'var(--line)', transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18,
          borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }} />
      </span>
    </label>
  );
}

function WebTakeoverCard() {
  const { t } = useTranslation('dashboard');
  const { account, refreshAccount } = useAuth();
  const [enabled, setEnabled] = useState(!!account?.web_takeover);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('hq_yealink_lost_dismiss') === '1' || localStorage.getItem('hq_yealink_back_dismiss') === '1';
    } catch { return false; }
  });

  useEffect(() => { setEnabled(!!account?.web_takeover); }, [account?.web_takeover]);

  useEffect(() => {
    window.onHotlineTakeoverState = (active) => setEnabled(!!active);
    return () => { delete window.onHotlineTakeoverState; };
  }, []);

  async function handleChange(next) {
    if (busy || !window.hotlineClient) return;
    setBusy(true); setError('');
    try {
      if (next) await window.hotlineClient.takeOver();
      else await window.hotlineClient.releaseTakeover();
      setEnabled(next);
      refreshAccount();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="hq-card p-6 mt-6">
      <h3 className="hq-label mb-1">{t('settings.callDevice', 'Call Device')}</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
        {t('settings.callDeviceBody', 'Choose which device carries the hotline call — your Yealink desk phone or this browser.')}
      </p>
      {error && <div className="hq-alert-error">{error}</div>}
      <div className="flex items-center justify-between gap-4 py-2" style={{ opacity: busy ? 0.6 : 1 }}>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {enabled ? t('settings.yealinkRelease', 'Yealink Release') : t('settings.webTakeOver', 'Web Take Over')}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {enabled
              ? t('settings.yealinkReleaseSub', 'This browser has the call. Switch off to hand it back to your Yealink desk phone.')
              : t('settings.webTakeOverSub', 'Switch on to move the call to this browser. Your Yealink stays idle until you release it.')}
          </div>
        </div>
        <span
          role="switch"
          aria-checked={enabled}
          onClick={() => handleChange(!enabled)}
          style={{
            width: 40, height: 22, borderRadius: 11, position: 'relative', flexShrink: 0,
            background: enabled ? 'var(--green)' : 'var(--line)', transition: 'background 0.15s',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: enabled ? 20 : 2, width: 18, height: 18,
            borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }} />
        </span>
      </div>
      {dismissed && (
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem('hq_yealink_lost_dismiss');
              localStorage.removeItem('hq_yealink_back_dismiss');
            } catch {}
            setDismissed(false);
          }}
          className="text-xs mt-3 underline"
          style={{ color: 'var(--muted)' }}
        >
          {t('settings.resetDismissedDialogs', 'Reset dismissed desk phone dialogs')}
        </button>
      )}
    </div>
  );
}

function NotificationsCard() {
  const { t } = useTranslation('dashboard');
  const { supported, needsInstallHint, permission, subscribed, busy, prefs, enable, disable, updatePrefs, sendTest } = usePushNotifications();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleEnable() {
    setError(''); setMessage('');
    try {
      await enable();
      setMessage(t('settings.notificationsEnabled'));
    } catch (err) { setError(err.message); }
  }

  async function handleDisable() {
    setError(''); setMessage('');
    try {
      await disable();
      setMessage(t('settings.notificationsDisabled'));
    } catch (err) { setError(err.message); }
  }

  async function handleTest() {
    setError(''); setMessage('');
    try {
      const sent = await sendTest();
      setMessage(sent > 0 ? t('settings.testSent') : t('settings.noDevices'));
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="hq-card p-6 mt-6">
      <h3 className="hq-label mb-1">{t('settings.notifications')}</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
        {t('settings.notificationsBody')}
      </p>
      {message && <div className="hq-alert-success">{message}</div>}
      {error && <div className="hq-alert-error">{error}</div>}

      {needsInstallHint ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          <Trans t={t} i18nKey="settings.iosInstallHint" components={{ arrow: <span aria-hidden /> }} />
        </p>
      ) : !supported ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('settings.pushUnsupported')}</p>
      ) : permission === 'denied' ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {t('settings.pushBlocked')}
        </p>
      ) : !subscribed ? (
        <button onClick={handleEnable} disabled={busy} className="hq-btn px-6 py-2.5">
          {busy ? t('settings.enabling') : t('settings.enableNotifications')}
        </button>
      ) : (
        <div>
          <div className="mb-3" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
            <PrefToggle
              label={t('settings.partsRequestsPref')}
              checked={!!prefs?.parts_requests}
              onChange={v => updatePrefs({ parts_requests: v })}
            />
            <PrefToggle
              label={t('settings.directCallsPref')}
              checked={!!prefs?.direct_calls}
              onChange={v => updatePrefs({ direct_calls: v })}
            />
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleTest} className="hq-btn px-4 py-2">{t('settings.sendTest')}</button>
            <button
              onClick={handleDisable}
              disabled={busy}
              className="text-sm font-semibold"
              style={{ color: 'var(--muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
            >
              {t('settings.disableOnDevice')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GestureControlCard() {
  const [enabled, setEnabled] = useState(isGestureEnabled);
  return (
    <div className="hq-card p-6 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="hq-label" style={{ marginBottom: 0 }}>Gesture Control</h3>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--red)', color: '#fff' }}>Experimental</span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
        Mute and unmute hands-free using your camera.
      </p>
      <PrefToggle
        label="Enable gesture control"
        checked={enabled}
        onChange={(v) => { setEnabled(v); setGestureEnabled(v); }}
      />
      {enabled && (
        <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--band, #f7f6f3)', border: '1px solid var(--line)' }}>
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: 20 }}>✋</span>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Hand in view → Unmute</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>Hold your hand in front of the camera to go live</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 20 }}>👋</span>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Hand away → Mute</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>Remove your hand to mute automatically</div>
            </div>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Camera activates only during a live call. Video stays on your device — nothing is sent to the server.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { t } = useTranslation('dashboard');
  const { account, apiFetch, refreshAccount } = useAuth();
  const [form, setForm] = useState({
    display_name: account?.display_name || '',
    company_name: account?.company_name || '',
    company_phone: account?.company_phone || '',
    company_address: account?.company_address || '',
    city: account?.city || '',
    state: account?.state || '',
    zip: account?.zip || '',
  });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [pwMessage, setPwMessage] = useState('');
  const [error, setError] = useState('');
  const [pwError, setPwError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [roomForm, setRoomForm] = useState({ city: '', state: '', message: '' });
  const [roomMessage, setRoomMessage] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);
  const [referralData, setReferralData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch('/referral').then(json => { if (json.data) setReferralData(json.data); }).catch(() => {});
  }, []);

  function copyReferralLink() {
    if (!referralData?.referral_link) return;
    navigator.clipboard.writeText(referralData.referral_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }
  function updatePw(field) {
    return e => setPasswordForm(f => ({ ...f, [field]: e.target.value }));
  }
  function updateRoom(field) {
    return e => setRoomForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setError(''); setMessage(''); setLoading(true);
    try {
      await apiFetch('/account', { method: 'PUT', body: JSON.stringify(form) });
      await refreshAccount();
      setMessage(t('settings.profileUpdated'));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwError(''); setPwMessage('');
    if (passwordForm.new_password !== passwordForm.confirm_password) { setPwError(t('settings.passwordsDoNotMatch')); return; }
    setPwLoading(true);
    try {
      await apiFetch('/account', {
        method: 'PUT',
        body: JSON.stringify({ current_password: passwordForm.current_password, new_password: passwordForm.new_password }),
      });
      setPwMessage(t('settings.passwordUpdated'));
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) { setPwError(err.message); }
    finally { setPwLoading(false); }
  }

  async function handleRoomRequestSubmit(e) {
    e.preventDefault();
    setRoomError(''); setRoomMessage(''); setRoomLoading(true);
    try {
      await apiFetch('/room-request', {
        method: 'POST',
        body: JSON.stringify({ city: roomForm.city, state: roomForm.state, message: roomForm.message }),
      });
      setRoomMessage(t('settings.roomRequestSubmitted'));
      setRoomForm({ city: '', state: '', message: '' });
    } catch (err) { setRoomError(err.message); }
    finally { setRoomLoading(false); }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">{t('settings.title')}</h2>

      <div className="hq-card p-6 mb-6">
        <h3 className="hq-label mb-4">{t('settings.profile')}</h3>
        {message && <div className="hq-alert-success">{message}</div>}
        {error && <div className="hq-alert-error">{error}</div>}

        <form onSubmit={handleProfileSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div><label className="hq-label">{t('settings.companyName')}</label><input type="text" value={form.company_name} onChange={update('company_name')} className="hq-input" /></div>
            <div><label className="hq-label">{t('settings.ownerName')}</label><input type="text" value={form.display_name} onChange={update('display_name')} className="hq-input" /></div>
          </div>
          <div className="mb-3"><label className="hq-label">{t('settings.phone')}</label><input type="text" value={form.company_phone} onChange={update('company_phone')} className="hq-input" placeholder={t('settings.phonePlaceholder')} /></div>
          <div className="mb-3"><label className="hq-label">{t('settings.address')}</label><input type="text" value={form.company_address} onChange={update('company_address')} className="hq-input" /></div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div><label className="hq-label">{t('settings.city')}</label><input type="text" value={form.city} onChange={update('city')} className="hq-input" /></div>
            <div><label className="hq-label">{t('settings.state')}</label><input type="text" value={form.state} onChange={update('state')} className="hq-input" /></div>
            <div><label className="hq-label">{t('settings.zip')}</label><input type="text" value={form.zip} onChange={update('zip')} className="hq-input" /></div>
          </div>
          <button type="submit" disabled={loading} className="hq-btn px-6 py-2.5">{loading ? t('settings.saving') : t('settings.saveChanges')}</button>
        </form>
      </div>

      <div className="hq-card p-6">
        <h3 className="hq-label mb-4">{t('settings.changePassword')}</h3>
        {pwMessage && <div className="hq-alert-success">{pwMessage}</div>}
        {pwError && <div className="hq-alert-error">{pwError}</div>}

        <form onSubmit={handlePasswordSubmit}>
          <div className="mb-3"><label className="hq-label">{t('settings.currentPassword')}</label><div className="relative"><input type={showCurrent ? "text" : "password"} value={passwordForm.current_password} onChange={updatePw('current_password')} required className="hq-input" style={{ paddingRight: 40 }} /><button type="button" tabIndex={-1} onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>{showCurrent ? <EyeOffSvg /> : <EyeSvg />}</button></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div><label className="hq-label">{t('settings.newPassword')}</label><div className="relative"><input type={showNew ? "text" : "password"} value={passwordForm.new_password} onChange={updatePw('new_password')} required minLength={6} className="hq-input" style={{ paddingRight: 40 }} /><button type="button" tabIndex={-1} onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>{showNew ? <EyeOffSvg /> : <EyeSvg />}</button></div></div>
            <div><label className="hq-label">{t('settings.confirmPassword')}</label><div className="relative"><input type={showConfirm ? "text" : "password"} value={passwordForm.confirm_password} onChange={updatePw('confirm_password')} required minLength={6} className="hq-input" style={{ paddingRight: 40 }} /><button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>{showConfirm ? <EyeOffSvg /> : <EyeSvg />}</button></div></div>
          </div>
          <button type="submit" disabled={pwLoading} className="hq-btn px-6 py-2.5">{pwLoading ? t('settings.updating') : t('settings.updatePassword')}</button>
        </form>
      </div>

      <WebTakeoverCard />

      <NotificationsCard />

      <GestureControlCard />

      <div className="hq-card p-6 mt-6">
        <h3 className="hq-label mb-1">{t('settings.requestNewRoom')}</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{t('settings.requestNewRoomBody')}</p>
        {roomMessage && <div className="hq-alert-success">{roomMessage}</div>}
        {roomError && <div className="hq-alert-error">{roomError}</div>}

        <form onSubmit={handleRoomRequestSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div><label className="hq-label">{t('settings.cityMarket')}</label><input type="text" value={roomForm.city} onChange={updateRoom('city')} required className="hq-input" /></div>
            <div><label className="hq-label">{t('settings.state')}</label><input type="text" value={roomForm.state} onChange={updateRoom('state')} className="hq-input" /></div>
          </div>
          <div className="mb-4"><label className="hq-label">{t('settings.message')}</label><textarea value={roomForm.message} onChange={updateRoom('message')} className="hq-input" rows={3} /></div>
          <button type="submit" disabled={roomLoading} className="hq-btn px-6 py-2.5">{roomLoading ? t('settings.submitting') : t('settings.submitRequest')}</button>
        </form>
      </div>

      {referralData && (
        <div className="hq-card p-6 mt-6">
          <h3 className="hq-label mb-1">{t('settings.referYard')}</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{t('settings.referYardBody')}</p>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-widest text-center" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
              {referralData.referral_code}
            </div>
            <button onClick={copyReferralLink} className="hq-btn px-4 py-3" style={{ whiteSpace: 'nowrap' }}>
              {copied ? t('settings.copied') : t('settings.copyLink')}
            </button>
          </div>

          {referralData.referral_count > 0 && (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              <Trans t={t} i18nKey="settings.yardsReferred" count={referralData.referral_count} components={{ b: <span className="font-bold" style={{ color: 'var(--ink)' }} /> }} />
              {referralData.referrals?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {referralData.referrals.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
                      <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{r.company_name || r.display_name}</span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{new Date(r.created_at * 1000).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {referralData.referral_count === 0 && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('settings.noReferrals')}</p>
          )}
        </div>
      )}

      <div className="mt-4 text-xs text-center" style={{ color: 'var(--muted)' }}>
        <Trans t={t} i18nKey="settings.loggedInAs" values={{ email: account?.email }} components={{ strong: <strong /> }} />
      </div>
    </div>
  );
}

function EyeSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EyeOffSvg() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}
