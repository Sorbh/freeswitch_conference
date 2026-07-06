import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

function formatTimeAgo(unixTs, t) {
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  if (diff < 60) return t('broadcastPanel.justNow');
  if (diff < 3600) return t('broadcastPanel.minutesAgo', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('broadcastPanel.hoursAgo', { n: Math.floor(diff / 3600) });
  return t('broadcastPanel.daysAgo', { n: Math.floor(diff / 86400) });
}

function formatDuration(ms, t) {
  if (!ms) return '--';
  const s = Math.round(ms / 1000);
  return s < 60 ? t('broadcastPanel.durationSeconds', { n: s }) : t('broadcastPanel.durationMinutes', { m: Math.floor(s / 60), s: s % 60 });
}

function parseParticipants(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

function parsePartDetails(raw) {
  if (!raw) return null;
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const parts = [];
    if (d.year && d.year !== 'null') parts.push(d.year);
    if (d.make && d.make !== 'null') parts.push(d.make);
    if (d.model && d.model !== 'null') parts.push(d.model);
    if (d.part && d.part !== 'null') parts.push(d.part);
    if (d.specification && d.specification !== 'null') parts.push(d.specification);
    return parts.length ? parts : null;
  } catch { return null; }
}

function parsePartDetailsExpanded(raw, t) {
  if (!raw) return null;
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const rows = {};
    if (d.year && d.year !== 'null') rows[t('broadcastPanel.year')] = d.year;
    if (d.make && d.make !== 'null') rows[t('broadcastPanel.make')] = d.make;
    if (d.model && d.model !== 'null') rows[t('broadcastPanel.model')] = d.model;
    if (d.part && d.part !== 'null') rows[t('broadcastPanel.part')] = d.part;
    if (d.specification && d.specification !== 'null') rows[t('broadcastPanel.spec')] = d.specification;
    return Object.keys(rows).length ? rows : null;
  } catch { return null; }
}

const PHONE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

function CallButton({ extension, onClick }) {
  const { t } = useTranslation('dashboard');
  if (!extension) return null;
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(extension); }}
      title={t('broadcastPanel.callThisYard')}
      style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, background: 'var(--red)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 3 }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
      {t('broadcastPanel.call')}
    </button>
  );
}

export default function BroadcastPanel({ rooms = [], collapsed, onToggle, hideHeader = false }) {
  const { t } = useTranslation('dashboard');
  const { token, account } = useAuth();
  const currentRoom = account?.current_room || account?.room;
  const [broadcasts, setBroadcasts] = useState([]);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);
  const sseRef = useRef(null);

  const connectSSE = useCallback(() => {
    if (!token || !currentRoom) return;
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }

    const url = '/api/v1/client/events/broadcasts/' + currentRoom + '?token=' + token + '&hasParts=1';
    const sse = new EventSource(url);
    sse.onmessage = function (event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          setBroadcasts(data.data || []);
          setTotal(data.total || 0);
          setPage(1);
        } else if (data.type === 'broadcast') {
          setBroadcasts(prev => [data.data, ...prev]);
          setTotal(prev => prev + 1);
        }
      } catch {}
    };
    sse.onerror = function () {
      try { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } } catch {}
      setTimeout(() => { if (token) connectSSE(); }, 5000);
    };
    sseRef.current = sse;
  }, [token, currentRoom]);

  useEffect(() => {
    if (collapsed) return;
    connectSSE();
    return () => { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } };
  }, [connectSSE, collapsed]);

  async function loadMore() {
    if (loading || !token || !currentRoom) return;
    const nextPage = page + 1;
    setLoading(true);
    try {
      const url = '/api/v1/client/broadcasts/list/' + currentRoom + '?page=' + nextPage + '&pageSize=50&hasParts=1';
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const json = await res.json();
      if (json.status && json.data) {
        setBroadcasts(prev => [...prev, ...json.data]);
        setPage(nextPage);
        setTotal(json.total);
      }
    } catch {} finally { setLoading(false); }
  }

  function playAudio(e, b) {
    e.stopPropagation();
    if (playingId === b.id) {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPlayingId(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); }
    const audio = new Audio('/api/v1/client/broadcasts/' + b.id + '/audio?token=' + token);
    audio.play().catch(() => {});
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(b.id);
  }

  function callExtension(ext) {
    if (window.hotlineClient && typeof window.hotlineClient.startBroadcastFeed === 'function') {
      // Use the SIP client's direct call if available
    }
    const dialCode = '*' + ext;
    if (window.RedlineExtensionDirectory) {
      const items = [];
      // Trigger via extension directory call mechanism
      fetch('/api/v1/client/direct-call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ extension: ext }),
      }).catch(() => {});
    }
  }

  useEffect(() => {
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

  const hasMore = broadcasts.length < total;

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-8 rounded-l-xl"
        style={{ height: 80, background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '-4px 0 16px rgba(22,24,29,0.15)' }}
        title={t('broadcastPanel.showBroadcasts')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)', borderLeft: '1px solid var(--line)' }}>
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 flex-shrink-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', height: 64 }}>
          <h3 className="hq-label" style={{ marginBottom: 0 }} title={t('broadcastPanel.totalTitle')}>{t('broadcastPanel.titleWithCount', { count: total })}</h3>
          <button onClick={onToggle} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }} title={t('broadcastPanel.hidePanel')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {broadcasts.length === 0 && (
          <div className="text-center py-12 px-4">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('broadcastPanel.noBroadcasts')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--line)' }}>{t('broadcastPanel.noBroadcastsHint')}</p>
          </div>
        )}

        <div className="px-3 py-3 space-y-2.5">
        {broadcasts.map(b => (
          <BroadcastRow
            key={b.id || b.created_at}
            b={b}
            expanded={expandedId != null && expandedId === b.id}
            playing={playingId != null && playingId === b.id}
            onToggle={() => setExpandedId(prev => prev === b.id ? null : b.id)}
            onPlay={e => playAudio(e, b)}
            onCall={callExtension}
          />
        ))}
        </div>

        {hasMore && (
          <div className="px-4 py-4 text-center" style={{ borderTop: '1px solid var(--line)' }}>
            <button
              onClick={loadMore}
              disabled={loading}
              className="text-xs font-semibold px-4 py-2 rounded-xl"
              style={{ background: 'var(--band)', color: 'var(--muted)', border: '1px solid var(--line)', cursor: loading ? 'wait' : 'pointer' }}
              title={t('broadcastPanel.loadOlderTitle')}
            >
              {loading ? t('broadcastPanel.loading') : t('broadcastPanel.loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BroadcastRow({ b, expanded, playing, onToggle, onPlay, onCall }) {
  const { t } = useTranslation('dashboard');
  const participants = parseParticipants(b.participants);
  const broadcaster = participants[0];
  const responders = participants.slice(1);
  const speaker = b.display_name || b.user_name || t('broadcastPanel.unknown');
  const transcript = b.transcription || b.local_transcription;
  const hasRecording = b.has_recording || !!b.recording_path;
  const partsPipe = parsePartDetails(b.part_details);
  const partsExpanded = parsePartDetailsExpanded(b.part_details, t);
  const isAnswered = b.answered === 1;

  const responderNames = responders.map(p => (p.displayName || p.userName || '').split(' / ').pop()).filter(Boolean);

  return (
    <div
      className="hq-card"
      onClick={onToggle}
      title={t('broadcastPanel.expandTitle')}
      style={{
        padding: '14px 16px',
        cursor: 'pointer',
        background: isAnswered ? 'rgba(18,183,106,0.06)' : 'var(--red-soft)',
        borderColor: isAnswered ? 'rgba(18,183,106,0.15)' : 'rgba(217,45,32,0.12)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = isAnswered ? 'rgba(18,183,106,0.1)' : '#fce8e6'; }}
      onMouseLeave={e => { e.currentTarget.style.background = isAnswered ? 'rgba(18,183,106,0.06)' : 'var(--red-soft)'; }}
    >
      {/* Status badge — top left */}
      <span
        title={isAnswered ? t('broadcastPanel.answeredTitle') : t('broadcastPanel.unansweredTitle')}
        style={{
          fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
          padding: '3px 10px', borderRadius: 999, display: 'inline-block', marginBottom: 8,
          background: isAnswered ? 'rgba(18,183,106,0.12)' : 'rgba(217,45,32,0.12)',
          color: isAnswered ? 'var(--green)' : 'var(--red)',
        }}
      >
        {isAnswered ? t('broadcastPanel.answered') : t('broadcastPanel.unanswered')}
      </span>

      {/* Play + speaker + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {hasRecording ? (
          <button
            onClick={onPlay}
            title={playing ? t('broadcastPanel.playingTitle') : t('broadcastPanel.playTitle')}
            style={{
              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: '#fff', border: 'none', cursor: 'pointer',
              background: playing ? 'var(--ink)' : (isAnswered ? 'var(--green)' : 'var(--red)'),
            }}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        ) : (
          <div
            title={t('broadcastPanel.noRecordingTitle')}
            style={{
              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: '#fff',
              background: isAnswered ? 'var(--green)' : 'var(--red)',
            }}
          >
            <MicIcon />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              <span className="marquee-name" title={t('broadcastPanel.broadcasterTitle', { name: speaker })} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                <span className="marquee-inner">{speaker}</span>
              </span>
              {broadcaster?.extension && <CallButton extension={broadcaster.extension} onClick={onCall} />}
            </div>
            <span title={t('broadcastPanel.timeSinceTitle')} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {formatTimeAgo(b.created_at, t)}
            </span>
          </div>

          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            <span title={t('broadcastPanel.durationTitle')}>{formatDuration(b.duration_ms, t)}</span>
            {b.listener_count > 0 && <span title={t('broadcastPanel.listeningTitle')}> · {t('broadcastPanel.listening', { count: b.listener_count })}</span>}
          </div>

          {/* Part details pipe — collapsed */}
          {partsPipe && !expanded && (
            <div title={t('broadcastPanel.partPipeTitle')} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {partsPipe.map((v, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: 'var(--line)', margin: '0 3px' }}>|</span>}
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{v}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Responders — collapsed */}
      {!expanded && isAnswered && responderNames.length > 0 && (
        <div title={t('broadcastPanel.respondersTitle')} style={{ fontSize: 11, color: 'var(--green)', marginTop: 6, paddingLeft: 48, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: 'var(--muted)' }}>{t('broadcastPanel.respondedBy')}</span> — {responderNames.join(', ')}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="animate-fadeIn" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
          {/* Part details table */}
          {partsExpanded && (
            <table title={t('broadcastPanel.partTableTitle')} style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 11 }}>
              <thead>
                <tr>
                  {Object.keys(partsExpanded).map(k => (
                    <th key={k} style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--line)' }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {Object.values(partsExpanded).map((v, i) => (
                    <td key={i} style={{ color: 'var(--ink)', fontWeight: 500, padding: '8px' }}>{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}

          {/* Transcript */}
          {transcript && (
            <div title={t('broadcastPanel.transcriptTitle')} style={{ background: 'var(--band)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{t('broadcastPanel.transcript')}</div>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink)', margin: 0 }}>{transcript}</p>
            </div>
          )}

          {/* Participants */}
          {isAnswered && participants.length > 0 && (
            <div>
              <div title={t('broadcastPanel.participantsTitle')} style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                {t('broadcastPanel.participantsCount', { count: participants.length })}
              </div>
              {participants.map((p, i) => {
                const isBroadcaster = i === 0;
                return (
                  <div
                    key={i}
                    title={isBroadcaster ? t('broadcastPanel.broadcasterRoleTitle') : t('broadcastPanel.responderRoleTitle')}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', overflow: 'hidden' }}
                  >
                    <span title={isBroadcaster ? t('broadcastPanel.speaker') : t('broadcastPanel.responder')} style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: isBroadcaster ? 'var(--red)' : 'var(--green)' }} />
                    <span className="marquee-name" style={{ fontSize: 12, color: 'var(--ink)', flex: 1, minWidth: 0 }}>
                      <span className="marquee-inner">{p.displayName || p.userName}</span>
                    </span>
                    <CallButton extension={p.extension} onClick={onCall} />
                    {!p.extension && <span title={t('broadcastPanel.noExtensionTitle')} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>—</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Response time */}
          {isAnswered && b.response_time_ms !== null && b.response_time_ms !== undefined && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginTop: 10 }}>
              <span title={t('broadcastPanel.responseTimeTitle')}>{b.response_time_ms === 0 ? t('broadcastPanel.respondedInstantly') : t('broadcastPanel.respondedIn', { seconds: (b.response_time_ms / 1000).toFixed(1) })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    </svg>
  );
}
