import { useState, useEffect, useCallback } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

const EXT_REQUEST_KEY_PREFIX = 'hq_ext_request_';

function getRequestCache(email) {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(EXT_REQUEST_KEY_PREFIX + email.toLowerCase());
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setRequestCache(email, extension) {
  if (!email) return;
  try {
    localStorage.setItem(EXT_REQUEST_KEY_PREFIX + email.toLowerCase(), JSON.stringify({
      extension,
      requestedAt: new Date().toISOString(),
    }));
  } catch {}
}

function clearRequestCache(email) {
  if (!email) return;
  try { localStorage.removeItem(EXT_REQUEST_KEY_PREFIX + email.toLowerCase()); } catch {}
}

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

function addressContains(address, part) {
  const forms = [part];
  const upper = String(part).trim().toUpperCase();
  if (US_STATES[upper]) forms.push(US_STATES[upper]);
  const abbr = Object.keys(US_STATES).find(k => US_STATES[k].toUpperCase() === upper);
  if (abbr) forms.push(abbr);
  return forms.some(f => new RegExp('\\b' + String(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(address));
}

function formatAddress(item) {
  const address = (item.address || '').trim().replace(/,\s*$/, '');
  const extras = [item.city, item.state, item.zip]
    .map(part => String(part || '').trim())
    .filter(part => part && !addressContains(address, part));
  return [address, extras.join(', ')].filter(Boolean).join(', ');
}

function monogram(name) {
  const words = String(name || '').trim().split(/\s+/).filter(w => /[a-z0-9]/i.test(w));
  if (!words.length) return '?';
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export default function MembersPage() {
  const { t } = useTranslation('dashboard');
  const { account, apiFetch } = useAuth();
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState('');
  const [withExtOnly, setWithExtOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [callLoading, setCallLoading] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestExt, setRequestExt] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState('');

  const hasExtension = !!(account?.extension);
  const cached = getRequestCache(account?.email);
  const hasPendingRequest = !hasExtension && !!cached;

  useEffect(() => {
    if (hasExtension && cached) clearRequestCache(account?.email);
  }, [hasExtension, cached, account?.email]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch('/members');
      setMembers(json.data || []);
    } catch (err) { setMessage(t('members.failedToLoad', { error: err.message })); }
    finally { setLoading(false); }
  }, [apiFetch, t]);

  useEffect(() => { load(); }, [load]);

  const ownEmail = (account?.email || '').toLowerCase();
  const filtered = members.filter(item => {
    if (item.email && item.email.toLowerCase() === ownEmail) return false;
    if (withExtOnly && !item.extension) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [item.companyName, item.displayName, item.email, item.city, item.state, item.phone, String(item.extension || ''), item.roomName]
      .join(' ').toLowerCase().includes(q);
  });

  async function handleCall(item) {
    setCallLoading(item.id); setMessage('');
    try {
      await apiFetch('/direct-call/start', { method: 'POST', body: JSON.stringify({ extension: item.extension }) });
    } catch (err) { setMessage(err.message); }
    finally { setCallLoading(null); }
  }

  async function handleShare(item) {
    const lines = [item.companyName || item.displayName];
    const address = formatAddress(item);
    if (address) lines.push(address);
    if (item.phone) lines.push(item.phone);
    const text = lines.join('\n');
    if (navigator.share) {
      try {
        // no title — some share targets render title + text, duplicating the name
        await navigator.share({ text });
        return;
      } catch { /* cancelled or unsupported — fall back to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(id => (id === item.id ? null : id)), 2000);
    } catch { setMessage(t('members.copyFailed')); }
  }

  async function submitRequest() {
    const ext = parseInt(requestExt, 10);
    if (!ext || ext < 100 || ext > 999) {
      setRequestError(t('extensions.rangeError'));
      return;
    }
    setRequestLoading(true);
    setRequestError('');
    try {
      await apiFetch('/extension-request', {
        method: 'POST',
        body: JSON.stringify({ extension: ext }),
      });
      setRequestCache(account?.email, ext);
      setRequestExt('');
      setRequestOpen(false);
    } catch (err) {
      setRequestError(err.message);
    } finally {
      setRequestLoading(false);
    }
  }

  function openChangeRequest() {
    setRequestExt(cached?.extension ? String(cached.extension) : '');
    setRequestError('');
    setRequestOpen(true);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold">{t('members.title')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {hasExtension
              ? <>{t('extensions.yourExtension')} <span className="font-bold font-mono" style={{ color: 'var(--red)' }}>*{account.extension}</span></>
              : t('members.subtitle')}
          </p>
        </div>
        <button onClick={load} className="hq-label px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--line)', marginBottom: 0, cursor: 'pointer', background: 'var(--surface)' }}>
          {t('extensions.refresh')}
        </button>
      </div>

      {/* ── Pending extension request ── */}
      {hasPendingRequest && !requestOpen && (
        <div className="hq-card mb-5" style={{ padding: '20px 24px' }}>
          <div className="flex items-center gap-4">
            <div className="h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red-soft)', padding: '0 20px' }}>
              <span className="text-lg font-bold font-mono" style={{ color: 'var(--red)' }}>*{cached.extension}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('extensions.requestReceivedTitle')}</div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                <Trans t={t} i18nKey="extensions.requestReceivedBody" values={{ ext: cached.extension }} components={{ mono: <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }} /> }} />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-5 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
            <button
              onClick={openChangeRequest}
              className="text-xs font-semibold px-4 py-2 rounded-lg"
              style={{ color: 'var(--red)', background: 'var(--red-soft)', border: 'none', cursor: 'pointer' }}
            >
              {t('extensions.changeExtension')}
            </button>
            <span className="text-[10px]" style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
              {t('extensions.requestedOn', { date: cached.requestedAt ? new Date(cached.requestedAt).toLocaleDateString() : '' })}
            </span>
          </div>
        </div>
      )}

      {/* ── No extension CTA ── */}
      {!hasExtension && !hasPendingRequest && !requestOpen && (
        <div className="hq-card p-5 mb-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red-soft)' }}>
              <PhoneIcon />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('extensions.ctaTitle')}</div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                {t('extensions.ctaBody')}
              </p>
              <button
                onClick={() => { setRequestOpen(true); setRequestError(''); setRequestExt(''); }}
                className="hq-btn px-5 py-2.5 text-sm mt-3"
              >
                {t('extensions.requestExtension')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Extension request form (dialog style) ── */}
      {requestOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center px-0 md:px-4 pt-6" style={{ background: 'rgba(17,24,39,0.36)', backdropFilter: 'blur(4px)' }}>
          <div className="hq-card w-full md:max-w-sm p-0 animate-fadeIn rounded-b-none md:rounded-b-[inherit] max-h-[calc(100vh-1rem)] overflow-auto" style={{ boxShadow: '0 24px 70px rgba(17,24,39,0.22)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="md:hidden w-10 h-1 rounded-full mx-auto mt-3" style={{ background: 'var(--line)' }} />

            <div className="p-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--ink)' }}>
                {hasPendingRequest ? t('extensions.dialogTitleChange') : t('extensions.dialogTitlePick')}
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                {t('extensions.dialogBody')}
              </p>

              {requestError && <div className="hq-alert-error mt-3">{requestError}</div>}

              <div className="mt-4">
                <label className="hq-label">{t('extensions.extensionLabel')}</label>
                <div className="flex items-center">
                  <span className="inline-flex items-center justify-center h-11 px-3 rounded-l-xl text-sm font-bold font-mono select-none" style={{ background: 'var(--band)', border: '1px solid var(--line)', borderRight: 'none', color: 'var(--red)' }}>*</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    value={requestExt}
                    onChange={e => setRequestExt(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    placeholder="101"
                    autoFocus
                    className="hq-input h-11 text-base font-bold"
                    style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}
                  />
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
                  {t('extensions.rangeHint')}
                </p>
              </div>

              {requestExt.length > 0 && (
                <div className="mt-4 px-4 py-3 rounded-xl text-center" style={{ background: 'var(--red-soft)' }}>
                  <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{t('extensions.previewLabel')}</div>
                  <div className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--mono)', color: requestExt.length === 3 ? 'var(--red)' : 'var(--line)' }}>
                    *{requestExt}{requestExt.length < 3 && <span style={{ color: 'var(--line)' }}>{'_'.repeat(3 - requestExt.length)}</span>}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={submitRequest}
                  disabled={requestLoading || requestExt.length < 3}
                  className="hq-btn flex-1 py-3 text-sm"
                >
                  {requestLoading ? t('extensions.sending') : t('extensions.requestExtensionButton')}
                </button>
                <button
                  onClick={() => setRequestOpen(false)}
                  className="px-5 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer' }}
                >
                  {t('extensions.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Search + filter ── */}
      <div className="flex items-center gap-3 mb-4">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('members.searchPlaceholder')} className="hq-input flex-1" />
        <button
          onClick={() => setWithExtOnly(v => !v)}
          className="flex-shrink-0 text-xs font-semibold px-4 rounded-xl whitespace-nowrap"
          style={{
            height: '44px', cursor: 'pointer',
            border: withExtOnly ? '1px solid var(--red)' : '1px solid var(--line)',
            background: withExtOnly ? 'var(--red-soft)' : 'var(--surface)',
            color: withExtOnly ? 'var(--red)' : 'var(--muted)',
          }}
        >
          {t('members.withExtension')}
        </button>
      </div>

      {message && <div className="hq-alert-error">{message}</div>}

      {/* ── Directory ── */}
      <style>{CARD_CSS}</style>
      {loading ? (
        <div className="hq-card p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>{t('members.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="hq-card p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>{t('members.noneFound')}</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 items-start">
          {filtered.map(item => {
            const isConnected = item.connected === true;
            const address = formatAddress(item);
            const name = item.companyName || item.displayName || t('extensions.unknown');
            const title = `${item.companyName || t('extensions.unknown')} / ${item.displayName || item.email}`;
            return (
              <div key={item.id} className="mem-card">
                <div className="mem-body">
                  <div className="mem-plate" aria-hidden="true">
                    {monogram(name)}
                    {item.extension && <span className={`mem-dot ${isConnected ? 'live' : ''}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="mem-name truncate" title={title}>{title}</span>
                      {(item.state || item.roomName) && <span className="mem-state">{item.state || item.roomName}</span>}
                      {item.extension && <span className="mem-key">*{item.extension}</span>}
                    </div>
                    {address && (
                      <div className="mem-row">
                        <PinIcon />
                        <span>{address}</span>
                      </div>
                    )}
                    {item.phone && (
                      <div className="mem-row">
                        <SmallPhoneIcon />
                        <a href={`tel:${item.phone.replace(/[^\d+]/g, '')}`} className="mem-tel">{item.phone}</a>
                      </div>
                    )}
                  </div>
                  <div className="mem-side">
                    <button
                      onClick={() => handleShare(item)}
                      title={t('members.share')}
                      aria-label={t('members.share')}
                      className="mem-share"
                      style={copiedId === item.id ? { color: 'var(--green)', borderColor: 'var(--green)' } : undefined}
                    >
                      {copiedId === item.id ? <CheckIcon /> : <ShareIcon />}
                    </button>
                    {item.extension && (
                      <button onClick={() => handleCall(item)} disabled={!isConnected || !hasExtension || callLoading === item.id}
                        className="hq-btn px-3.5 rounded-full text-xs"
                        style={{ height: '28px', ...(isConnected && hasExtension ? {} : { background: '#e5e7eb', color: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' }) }}>
                        {callLoading === item.id ? '...' : isConnected ? t('extensions.call') : t('extensions.offline')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CARD_CSS = `
.mem-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 1rem;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05);
  overflow: hidden;
  transition: box-shadow .18s ease, transform .18s ease, border-color .18s ease;
}
.mem-card:hover {
  transform: translateY(-1px);
  border-color: #d9d5cc;
  box-shadow: 0 1px 2px rgba(22,24,29,0.05), 0 14px 32px -14px rgba(22,24,29,0.18);
}
.mem-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
}
.mem-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  align-self: stretch;
  flex-shrink: 0;
}
.mem-state {
  flex-shrink: 0;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  background: var(--band);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 1px 6px;
  line-height: 16px;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mem-plate {
  position: relative;
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: var(--band);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.02em;
  color: var(--ink);
  user-select: none;
}
.mem-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #cfcbc2;
  border: 2px solid var(--surface);
}
.mem-dot.live { background: var(--green); }
.mem-dot.live::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid var(--green);
  opacity: 0;
  animation: mem-ping 2.4s ease-out infinite;
}
@keyframes mem-ping {
  0%   { transform: scale(0.5); opacity: 0.7; }
  70%  { transform: scale(1.15); opacity: 0; }
  100% { transform: scale(1.15); opacity: 0; }
}
.mem-name {
  font-family: var(--display);
  font-weight: 700;
  font-size: 16px;
  color: var(--ink);
}
.mem-key {
  flex-shrink: 0;
  font-family: var(--mono);
  font-weight: 700;
  font-size: 12.5px;
  letter-spacing: 0.05em;
  color: var(--red);
  background: linear-gradient(#ffffff, var(--band));
  border: 1px solid var(--line);
  border-bottom-width: 3px;
  border-radius: 7px;
  padding: 1px 8px 0;
  line-height: 20px;
}
.mem-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 5px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--muted);
}
.mem-row svg { margin-top: 2px; }
.mem-tel { color: inherit; text-decoration: none; }
.mem-tel:hover { color: var(--red); }
.mem-share {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: color .15s ease, border-color .15s ease;
}
.mem-share:hover { color: var(--ink); border-color: #d9d5cc; }
@media (prefers-reduced-motion: reduce) {
  .mem-card, .mem-card:hover { transform: none; transition: none; }
  .mem-dot.live::after { animation: none; }
}
`;

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function SmallPhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
