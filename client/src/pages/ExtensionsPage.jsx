import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function ExtensionsPage() {
  const { account, apiFetch } = useAuth();
  const [extensions, setExtensions] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [callLoading, setCallLoading] = useState(null);

  // Extension request state
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestExt, setRequestExt] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  const hasExtension = !!(account?.extension);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch('/extensions');
      setExtensions(json.data || []);
    } catch (err) { setMessage('Failed to load extensions: ' + err.message); }
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
      setMessage(`Calling *${item.extension}...`);
    } catch (err) { setMessage(err.message); }
    finally { setCallLoading(null); }
  }

  async function handleRequestExtension() {
    const ext = parseInt(requestExt, 10);
    if (!ext || ext < 100 || ext > 999) {
      setRequestMessage('Enter an extension from 100 to 999.');
      return;
    }
    setRequestLoading(true);
    setRequestMessage('');
    try {
      const json = await apiFetch('/extension-request', {
        method: 'POST',
        body: JSON.stringify({ extension: ext }),
      });
      setRequestMessage(json.message || 'Extension request sent.');
      setRequestExt('');
      setRequestOpen(false);
    } catch (err) {
      setRequestMessage(err.message);
    } finally {
      setRequestLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Extensions</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {hasExtension
              ? <>Your extension: <span className="font-bold font-mono" style={{ color: 'var(--red)' }}>*{account.extension}</span></>
              : 'Search and call other users directly'
            }
          </p>
        </div>
        <button onClick={load} className="hq-label px-3 py-1.5 rounded-lg" style={{ border: '1px solid var(--line)', marginBottom: 0, cursor: 'pointer', background: 'var(--surface)' }}>Refresh</button>
      </div>

      {/* Extension request form (when opened) */}
      {requestOpen && (
        <div className="hq-card p-4 mb-4 animate-fadeIn">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Request your preferred extension</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Choose any 3-digit extension from 100 to 999.</div>
            </div>
            <button onClick={() => setRequestOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--red-soft)', color: 'var(--red)', fontSize: '16px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>x</button>
          </div>
          {requestMessage && <div className="hq-alert-error" style={{ marginBottom: '0.75rem' }}>{requestMessage}</div>}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--red-soft)', border: '1px solid rgba(217,45,32,0.15)' }}>
            <span className="text-lg font-bold" style={{ color: 'var(--red)' }}>*</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={3}
              value={requestExt}
              onChange={e => setRequestExt(e.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="101"
              className="flex-1 text-lg font-bold bg-transparent border-none outline-none"
              style={{ color: 'var(--ink)', letterSpacing: '0.04em', minWidth: 0 }}
            />
            <button
              onClick={handleRequestExtension}
              disabled={requestLoading}
              className="hq-btn px-4 py-2 text-xs"
              style={{ borderRadius: '999px' }}
            >
              {requestLoading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* Search + directory - blurred if no extension */}
      <div className="relative">
        {/* Blur overlay if user has no extension */}
        {!hasExtension && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(3px)' }}>
            <div className="text-center px-6">
              <button
                onClick={() => setRequestOpen(true)}
                className="hq-btn px-6 py-3 text-sm"
              >
                Request Extension
              </button>
              <p className="text-xs font-bold mt-3" style={{ color: 'var(--red-deep)', lineHeight: 1.3 }}>
                Limited extension slots left.<br />Request yours to unlock the directory.
              </p>
            </div>
          </div>
        )}

        <div style={!hasExtension && !loading ? { filter: 'blur(2px)', opacity: 0.35, pointerEvents: 'none' } : {}}>
          <div className="mb-4">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search company, name, extension..." className="hq-input" />
          </div>

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
                  <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4 border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
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
