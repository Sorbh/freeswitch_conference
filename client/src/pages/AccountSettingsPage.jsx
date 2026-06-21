import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

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

      <div className="mt-4 text-xs text-center" style={{ color: 'var(--muted)' }}>
        Logged in as <strong>{account?.email}</strong>
      </div>
    </div>
  );
}
