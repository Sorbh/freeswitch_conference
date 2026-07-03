import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';

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

function NotificationsCard() {
  const { supported, needsInstallHint, permission, subscribed, busy, prefs, enable, disable, updatePrefs, sendTest } = usePushNotifications();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleEnable() {
    setError(''); setMessage('');
    try {
      await enable();
      setMessage('Notifications enabled on this device.');
    } catch (err) { setError(err.message); }
  }

  async function handleDisable() {
    setError(''); setMessage('');
    try {
      await disable();
      setMessage('Notifications disabled on this device.');
    } catch (err) { setError(err.message); }
  }

  async function handleTest() {
    setError(''); setMessage('');
    try {
      const sent = await sendTest();
      setMessage(sent > 0 ? 'Test notification sent.' : 'No devices registered — enable notifications first.');
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="hq-card p-6 mt-6">
      <h3 className="hq-label mb-1">Notifications</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
        Get notified about parts requests you missed and incoming calls — even when Hotline HQ is closed.
      </p>
      {message && <div className="hq-alert-success">{message}</div>}
      {error && <div className="hq-alert-error">{error}</div>}

      {needsInstallHint ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          On iPhone/iPad, first add Hotline HQ to your Home Screen (Share <span aria-hidden>→</span> "Add to Home Screen"),
          then open it from there to enable notifications.
        </p>
      ) : !supported ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>This browser does not support push notifications.</p>
      ) : permission === 'denied' ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Notifications are blocked. Allow them for this site in your browser settings, then reload.
        </p>
      ) : !subscribed ? (
        <button onClick={handleEnable} disabled={busy} className="hq-btn px-6 py-2.5">
          {busy ? 'Enabling...' : 'Enable notifications on this device'}
        </button>
      ) : (
        <div>
          <div className="mb-3" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
            <PrefToggle
              label="Parts requests in my room"
              checked={!!prefs?.parts_requests}
              onChange={v => updatePrefs({ parts_requests: v })}
            />
            <PrefToggle
              label="Incoming direct calls"
              checked={!!prefs?.direct_calls}
              onChange={v => updatePrefs({ direct_calls: v })}
            />
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleTest} className="hq-btn px-4 py-2">Send test</button>
            <button
              onClick={handleDisable}
              disabled={busy}
              className="text-sm font-semibold"
              style={{ color: 'var(--muted)', background: 'transparent', border: 0, cursor: 'pointer' }}
            >
              Disable on this device
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountSettingsPage() {
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
      setMessage('Profile updated.');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwError(''); setPwMessage('');
    if (passwordForm.new_password !== passwordForm.confirm_password) { setPwError('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      await apiFetch('/account', {
        method: 'PUT',
        body: JSON.stringify({ current_password: passwordForm.current_password, new_password: passwordForm.new_password }),
      });
      setPwMessage('Password updated.');
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
      setRoomMessage('Room request submitted. We will be in touch!');
      setRoomForm({ city: '', state: '', message: '' });
    } catch (err) { setRoomError(err.message); }
    finally { setRoomLoading(false); }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">Account Settings</h2>

      <div className="hq-card p-6 mb-6">
        <h3 className="hq-label mb-4">Profile</h3>
        {message && <div className="hq-alert-success">{message}</div>}
        {error && <div className="hq-alert-error">{error}</div>}

        <form onSubmit={handleProfileSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div><label className="hq-label">Company Name</label><input type="text" value={form.company_name} onChange={update('company_name')} className="hq-input" /></div>
            <div><label className="hq-label">Owner Name</label><input type="text" value={form.display_name} onChange={update('display_name')} className="hq-input" /></div>
          </div>
          <div className="mb-3"><label className="hq-label">Phone</label><input type="text" value={form.company_phone} onChange={update('company_phone')} className="hq-input" placeholder="(555) 555-5555" /></div>
          <div className="mb-3"><label className="hq-label">Address</label><input type="text" value={form.company_address} onChange={update('company_address')} className="hq-input" /></div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div><label className="hq-label">City</label><input type="text" value={form.city} onChange={update('city')} className="hq-input" /></div>
            <div><label className="hq-label">State</label><input type="text" value={form.state} onChange={update('state')} className="hq-input" /></div>
            <div><label className="hq-label">Zip</label><input type="text" value={form.zip} onChange={update('zip')} className="hq-input" /></div>
          </div>
          <button type="submit" disabled={loading} className="hq-btn px-6 py-2.5">{loading ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>

      <div className="hq-card p-6">
        <h3 className="hq-label mb-4">Change Password</h3>
        {pwMessage && <div className="hq-alert-success">{pwMessage}</div>}
        {pwError && <div className="hq-alert-error">{pwError}</div>}

        <form onSubmit={handlePasswordSubmit}>
          <div className="mb-3"><label className="hq-label">Current Password</label><input type="password" value={passwordForm.current_password} onChange={updatePw('current_password')} required className="hq-input" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div><label className="hq-label">New Password</label><input type="password" value={passwordForm.new_password} onChange={updatePw('new_password')} required minLength={6} className="hq-input" /></div>
            <div><label className="hq-label">Confirm</label><input type="password" value={passwordForm.confirm_password} onChange={updatePw('confirm_password')} required minLength={6} className="hq-input" /></div>
          </div>
          <button type="submit" disabled={pwLoading} className="hq-btn px-6 py-2.5">{pwLoading ? 'Updating...' : 'Update Password'}</button>
        </form>
      </div>

      <NotificationsCard />

      <div className="hq-card p-6 mt-6">
        <h3 className="hq-label mb-1">Request New Room</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Want to add a new city or market?</p>
        {roomMessage && <div className="hq-alert-success">{roomMessage}</div>}
        {roomError && <div className="hq-alert-error">{roomError}</div>}

        <form onSubmit={handleRoomRequestSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div><label className="hq-label">City / Market</label><input type="text" value={roomForm.city} onChange={updateRoom('city')} required className="hq-input" /></div>
            <div><label className="hq-label">State</label><input type="text" value={roomForm.state} onChange={updateRoom('state')} className="hq-input" /></div>
          </div>
          <div className="mb-4"><label className="hq-label">Message</label><textarea value={roomForm.message} onChange={updateRoom('message')} className="hq-input" rows={3} /></div>
          <button type="submit" disabled={roomLoading} className="hq-btn px-6 py-2.5">{roomLoading ? 'Submitting...' : 'Submit Request'}</button>
        </form>
      </div>

      {referralData && (
        <div className="hq-card p-6 mt-6">
          <h3 className="hq-label mb-1">Refer a Yard</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Share your code and get 10% off your future bill for each referral.</p>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-widest text-center" style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
              {referralData.referral_code}
            </div>
            <button onClick={copyReferralLink} className="hq-btn px-4 py-3" style={{ whiteSpace: 'nowrap' }}>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          {referralData.referral_count > 0 && (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              <span className="font-bold" style={{ color: 'var(--ink)' }}>{referralData.referral_count}</span> yard{referralData.referral_count !== 1 ? 's' : ''} referred
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
            <p className="text-xs" style={{ color: 'var(--muted)' }}>No referrals yet. Share your link to get started!</p>
          )}
        </div>
      )}

      <div className="mt-4 text-xs text-center" style={{ color: 'var(--muted)' }}>
        Logged in as <strong>{account?.email}</strong>
      </div>
    </div>
  );
}
