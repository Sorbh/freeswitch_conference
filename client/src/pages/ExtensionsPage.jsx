import { useState, useEffect, useCallback } from 'react';
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

export default function ExtensionsPage() {
  const { account, apiFetch } = useAuth();
  const [extensions, setExtensions] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [callLoading, setCallLoading] = useState(null);

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
      const json = await apiFetch('/extensions');
      setExtensions(json.data || []);
    } catch (err) { setMessage('Failed to load: ' + err.message); }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const ownExt = account?.extension ? String(account.extension) : '';
  const filtered = extensions.filter(item => {
    if (ownExt && String(item.extension) === ownExt) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return [item.companyName, item.displayName, item.email, String(item.extension), item.roomName]
      .join(' ').toLowerCase().includes(q);
  });

  async function handleCall(item) {
    setCallLoading(item.id); setMessage('');
    try {
      await apiFetch('/direct-call/start', { method: 'POST', body: JSON.stringify({ extension: item.extension }) });
    } catch (err) { setMessage(err.message); }
    finally { setCallLoading(null); }
  }

  async function submitRequest() {
    const ext = parseInt(requestExt, 10);
    if (!ext || ext < 100 || ext > 999) {
      setRequestError('Enter a number between 100 and 999');
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

  const isLocked = !hasExtension;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold">Extensions</h2>
          {hasExtension && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Your extension: <span className="font-bold font-mono" style={{ color: 'var(--red)' }}>*{account.extension}</span>
            </p>
          )}
          {!hasExtension && !hasPendingRequest && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              Get a 3-digit extension to call other yards directly
            </p>
          )}
        </div>
        {hasExtension && (
          <button onClick={load} className="hq-label px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--line)', marginBottom: 0, cursor: 'pointer', background: 'var(--surface)' }}>
            Refresh
          </button>
        )}
      </div>

      {/* ── Pending request ── */}
      {hasPendingRequest && !requestOpen && (
        <div className="hq-card mb-5" style={{ padding: '20px 24px' }}>
          <div className="flex items-center gap-4">
            <div className="h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red-soft)', padding: '0 20px' }}>
              <span className="text-lg font-bold font-mono" style={{ color: 'var(--red)' }}>*{cached.extension}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Extension request received</div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                We're reviewing your request for <span className="font-mono font-semibold" style={{ color: 'var(--ink)' }}>*{cached.extension}</span>. You'll get access to the directory once it's assigned.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-5 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
            <button
              onClick={openChangeRequest}
              className="text-xs font-semibold px-4 py-2 rounded-lg"
              style={{ color: 'var(--red)', background: 'var(--red-soft)', border: 'none', cursor: 'pointer' }}
            >
              Change extension
            </button>
            <span className="text-[10px]" style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
              Requested {cached.requestedAt ? new Date(cached.requestedAt).toLocaleDateString() : ''}
            </span>
          </div>
        </div>
      )}

      {/* ── No request CTA ── */}
      {!hasExtension && !hasPendingRequest && !requestOpen && (
        <div className="hq-card p-5 mb-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red-soft)' }}>
              <PhoneIcon />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Get your direct extension</div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                Pick a 3-digit number and call any yard in the network directly — no more waiting on the broadcast line.
              </p>
              <button
                onClick={() => { setRequestOpen(true); setRequestError(''); setRequestExt(''); }}
                className="hq-btn px-5 py-2.5 text-sm mt-3"
              >
                Request extension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Request form (dialog style) ── */}
      {requestOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center px-0 md:px-4 pt-6" style={{ background: 'rgba(17,24,39,0.36)', backdropFilter: 'blur(4px)' }}>
          <div className="hq-card w-full md:max-w-sm p-0 animate-fadeIn rounded-b-none md:rounded-b-[inherit] max-h-[calc(100vh-1rem)] overflow-auto" style={{ boxShadow: '0 24px 70px rgba(17,24,39,0.22)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Drag handle on mobile */}
            <div className="md:hidden w-10 h-1 rounded-full mx-auto mt-3" style={{ background: 'var(--line)' }} />

            <div className="p-5">
              <h3 className="text-base font-bold" style={{ color: 'var(--ink)' }}>
                {hasPendingRequest ? 'Change your extension' : 'Pick your extension'}
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Choose a 3-digit number. Other yards will dial this to call you privately.
              </p>

              {requestError && <div className="hq-alert-error mt-3">{requestError}</div>}

              {/* Extension input — admin style grouped input */}
              <div className="mt-4">
                <label className="hq-label">Direct Call Extension</label>
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
                  Any number from 100 to 999
                </p>
              </div>

              {/* Live preview */}
              {requestExt.length > 0 && (
                <div className="mt-4 px-4 py-3 rounded-xl text-center" style={{ background: 'var(--red-soft)' }}>
                  <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>Your extension</div>
                  <div className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--mono)', color: requestExt.length === 3 ? 'var(--red)' : 'var(--line)' }}>
                    *{requestExt}{requestExt.length < 3 && <span style={{ color: 'var(--line)' }}>{'_'.repeat(3 - requestExt.length)}</span>}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={submitRequest}
                  disabled={requestLoading || requestExt.length < 3}
                  className="hq-btn flex-1 py-3 text-sm"
                >
                  {requestLoading ? 'Sending...' : 'Request Extension'}
                </button>
                <button
                  onClick={() => setRequestOpen(false)}
                  className="px-5 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Directory ── */}
      <div className="relative">
        {isLocked && !loading && (
          <div className="absolute inset-0 z-10 rounded-2xl" style={{ background: 'rgba(255,255,255,0.35)', backdropFilter: 'blur(3px)' }}>
            {!hasPendingRequest && !requestOpen && (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Request an extension to unlock the directory</p>
              </div>
            )}
          </div>
        )}

        <div style={isLocked && !loading ? { opacity: 0.4, pointerEvents: 'none' } : {}}>
          {hasExtension && (
            <div className="mb-4">
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search company, name, extension..." className="hq-input" />
            </div>
          )}

          {message && <div className="hq-alert-error">{message}</div>}

          <div className="hq-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Loading extensions...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>No extensions found</div>
            ) : (
              filtered.map(item => {
                const isConnected = item.connected === true;
                return (
                  <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{item.companyName || 'Unknown'} / {item.displayName || item.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{item.roomName || ''}</span>
                        <span className="text-xs font-bold font-mono">*{item.extension}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: isConnected ? 'var(--green)' : 'var(--muted)' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: isConnected ? 'var(--green)' : 'var(--muted)' }} />
                          {isConnected ? 'Available' : 'Offline'}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => handleCall(item)} disabled={!isConnected || callLoading === item.id}
                      className="hq-btn flex-shrink-0 px-4 py-2 rounded-full text-xs"
                      style={isConnected ? {} : { background: '#e5e7eb', color: '#94a3b8', boxShadow: 'none', cursor: 'not-allowed' }}>
                      {callLoading === item.id ? '...' : isConnected ? 'Call' : 'Offline'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
