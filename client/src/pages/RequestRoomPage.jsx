import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function RequestRoomPage() {
  const { apiFetch } = useAuth();
  const [form, setForm] = useState({ city: '', state: '', message: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const json = await apiFetch('/room-request', { method: 'POST', body: JSON.stringify(form) });
      setSuccess(json.message || 'Request submitted!');
      setForm({ city: '', state: '', message: '' });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold mb-2">Request a New Room</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Want to add a new city or market? Submit a request and we'll set it up.
      </p>

      <div className="hq-card p-6">
        {success && <div className="hq-alert-success">{success}</div>}
        {error && <div className="hq-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="hq-label">City / Market</label><input type="text" value={form.city} onChange={update('city')} required className="hq-input" placeholder="e.g. Dallas" /></div>
            <div><label className="hq-label">State</label><input type="text" value={form.state} onChange={update('state')} className="hq-input" placeholder="e.g. TX" /></div>
          </div>
          <div className="mb-4">
            <label className="hq-label">Message (optional)</label>
            <textarea value={form.message} onChange={update('message')} rows={3} className="hq-input resize-none" placeholder="Any additional details..." />
          </div>
          <button type="submit" disabled={loading} className="hq-btn w-full py-3">{loading ? 'Submitting...' : 'Submit Request'}</button>
        </form>
      </div>
    </div>
  );
}
