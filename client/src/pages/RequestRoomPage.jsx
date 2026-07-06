import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

export default function RequestRoomPage() {
  const { t } = useTranslation('dashboard');
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
      setSuccess(json.message || t('requestRoom.submitted'));
      setForm({ city: '', state: '', message: '' });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-bold mb-2">{t('requestRoom.title')}</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        {t('requestRoom.subtitle')}
      </p>

      <div className="hq-card p-6">
        {success && <div className="hq-alert-success">{success}</div>}
        {error && <div className="hq-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="hq-label">{t('requestRoom.cityMarket')}</label><input type="text" value={form.city} onChange={update('city')} required className="hq-input" placeholder={t('requestRoom.cityPlaceholder')} /></div>
            <div><label className="hq-label">{t('requestRoom.state')}</label><input type="text" value={form.state} onChange={update('state')} className="hq-input" placeholder={t('requestRoom.statePlaceholder')} /></div>
          </div>
          <div className="mb-4">
            <label className="hq-label">{t('requestRoom.messageOptional')}</label>
            <textarea value={form.message} onChange={update('message')} rows={3} className="hq-input resize-none" placeholder={t('requestRoom.messagePlaceholder')} />
          </div>
          <button type="submit" disabled={loading} className="hq-btn w-full py-3">{loading ? t('requestRoom.submitting') : t('requestRoom.submitRequest')}</button>
        </form>
      </div>
    </div>
  );
}
