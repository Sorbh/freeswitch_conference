import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

export default function ConferencePage() {
  const { t } = useTranslation('dashboard');
  const { account, token } = useAuth();
  const { sipConnected: connected = false, sipMuted: muted = true, toggleMute, isListenOnly = false } = useOutletContext() || {};
  const [callerIds, setCallerIds] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [unmutedCount, setUnmutedCount] = useState(0);
  const [onlineCounts, setOnlineCounts] = useState({});
  const [rooms, setRooms] = useState([]);
  const sseRef = useRef(null);

  const totalOnline = Object.values(onlineCounts).reduce((sum, n) => sum + n, 0);
  const roomOnline = onlineCounts[account?.current_room || account?.room] || 0;

  // Fetch room details for name lookup
  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/client/rooms/details', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(json => { if (json.data) setRooms(json.data); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!account || !token) return;

    window._onCallerIdData = function (data) {
      if (data.callerIds) setCallerIds(data.callerIds);
      if (data.userCount !== undefined) setUserCount(data.userCount);
      if (data.unmutedCount !== undefined) setUnmutedCount(data.unmutedCount);
      if (data.online) setOnlineCounts(data.online);
    };

    window.updateOnlineCounts = function (online) {
      setOnlineCounts(online || {});
    };

    // Own SSE connection for callerID data (works even if SIP client login fails)
    const activeRoom = account.current_room || account.room;
    if (activeRoom && token) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      const sse = new EventSource(`/api/v1/client/events/room/${activeRoom}?token=${token}`);
      sse.onmessage = function (event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'room_change' && data.email === account.email) {
            if (typeof window.onHotlineRoomChange === 'function') {
              window.onHotlineRoomChange({ source: 'sse', room: data.toRoom, roomName: data.toRoomName, direction: data.direction });
            } else {
              window.location.reload();
            }
            return;
          }
          if (data.callerIds) setCallerIds(data.callerIds);
          if (data.userCount !== undefined) setUserCount(data.userCount);
          if (data.unmutedCount !== undefined) setUnmutedCount(data.unmutedCount);
          if (data.online) setOnlineCounts(data.online);
        } catch {}
      };
      sseRef.current = sse;
    }

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };

  }, [account, token]);

  useEffect(() => {
    return () => {
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  function handleToggleMute() {
    if (toggleMute) toggleMute();
    else if (window.hotlineClient) window.hotlineClient.toggleMute();
  }

  const room = account?.current_room || account?.room;
  const currentRoomData = rooms.find(r => r.id === room);
  const roomDisplayName = currentRoomData ? currentRoomData.name : (room ? t('layout.roomFallback', { id: room }) : t('conference.roomNotAvailable'));

  const [showBanner, setShowBanner] = useState(() => localStorage.getItem('hideReferralBanner') !== 'true');

  function dismissBanner() {
    setShowBanner(false);
    localStorage.setItem('hideReferralBanner', 'true');
  }

  return (
    <div>
      {showBanner && (
        <div className="hq-card referral-banner mb-4 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="referral-emoji text-xl flex-shrink-0">🎉</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('conference.referralTitle')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}><Trans t={t} i18nKey="conference.referralBody" components={{ settingsLink: <a href="/client/dashboard/settings" className="font-semibold" style={{ color: 'var(--red)' }} /> }} /></p>
            </div>
          </div>
          <button onClick={dismissBanner} className="flex-shrink-0 p-1.5 rounded-lg" style={{ color: 'var(--muted)' }} aria-label={t('conference.dismiss')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Desktop: title + mute button */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{t('conference.title')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {account?.company_name || ''} — {roomDisplayName}
          </p>
        </div>
        {connected && !isListenOnly && (
          <div className="flex items-center gap-3">
            <button onClick={handleToggleMute} className="hq-btn flex items-center gap-2 px-4 py-2" style={{ background: muted ? 'var(--red)' : 'var(--green)', boxShadow: muted ? '0 8px 18px rgba(217,45,32,0.3)' : '0 8px 18px rgba(18,183,106,0.3)' }}>
              {muted ? <><MicOffIcon /> {t('conference.unmute')}</> : <><MicOnIcon /> {t('conference.mute')}</>}
            </button>
          </div>
        )}
        {connected && isListenOnly && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(37,99,235,0.1)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
            <span className="text-xs font-bold">{t('conference.listenOnly')}</span>
          </div>
        )}
      </div>

      {connected && !isListenOnly && (
        <div className="hidden md:block mb-4 px-4 py-2.5 rounded-xl text-xs" style={{ background: 'var(--band)', color: 'var(--muted)', border: '1px solid var(--line)' }}>
          <Trans t={t} i18nKey="conference.muteShortcutHint" components={{ kbd: <span className="font-semibold font-mono" /> }} />
        </div>
      )}

      {/* Online stats bar — visible as soon as SSE data flows */}
      {(connected || totalOnline > 0) && (
        <div className="flex items-center gap-3 mb-4">
          <StatPill label={t('conference.thisRoom')} value={roomOnline} color="var(--green)" />
          <StatPill label={t('conference.network')} value={totalOnline} color="var(--red)" />
          <StatPill label={t('conference.speaking')} value={unmutedCount} color="#f59e0b" />
        </div>
      )}

      {/* Caller ID card */}
      <div className="hq-card p-5 min-h-[200px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="hq-label" style={{ marginBottom: 0 }}>
            {connected ? t('conference.activeCallersCount', { count: unmutedCount }) : t('conference.activeCallers')}
          </h3>
          <span className="w-2 h-2 rounded-full" style={{ background: connected ? 'var(--green)' : 'var(--line)', boxShadow: connected ? '0 0 0 3px rgba(18,183,106,0.15)' : 'none' }} />
        </div>

        {!connected && (
          <div className="text-center py-10">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('conference.waitingForConnection')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--line)' }}>{t('conference.autoConnectHint')}</p>
          </div>
        )}

        {connected && callerIds.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('conference.noOneSpeaking')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--line)' }}>{t('conference.usersInRoomMuted', { count: roomOnline })}</p>
          </div>
        )}

        {callerIds.length > 0 && (
          <div className="space-y-2">
            {callerIds.map((name, i) => (
              <CallerCard key={i} name={name} />
            ))}
          </div>
        )}

        {/* Hidden div for SIP client compatibility — it writes innerHTML here */}
        <div id="caller_grid" style={{ display: 'none' }} />
      </div>

      <div id="mixedaudio" style={{ display: 'none' }}><audio id="roomaudio" autoPlay /></div>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="min-w-0">
        <div className="text-base font-bold" style={{ fontFamily: 'var(--display)', color: 'var(--ink)', lineHeight: 1 }}>{value}</div>
        <div className="text-[9px] font-semibold tracking-widest uppercase" style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function CallerCard({ name }) {
  const parts = name.split(' / ');
  const company = parts[0] || name;
  const person = parts[1] || '';

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--red-soft)', border: '1px solid rgba(217,45,32,0.1)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red)', color: '#fff' }}>
        <SpeakerIcon />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{company}</div>
        {person && <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{person}</div>}
      </div>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    </svg>
  );
}

function MicOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.48-.35 2.15" />
      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
