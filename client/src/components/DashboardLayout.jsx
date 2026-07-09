import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LanguageSwitcher from './LanguageSwitcher';

const BroadcastPanel = lazy(() => import('./BroadcastPanel'));

const BOTTOM_NAV_ITEMS = [
  { to: '/client/dashboard', labelKey: 'layout.nav.conference', icon: PhoneIcon, end: true },
  { to: '/client/dashboard/members', labelKey: 'layout.nav.members', icon: GridIcon },
  { to: '/client/dashboard/settings', labelKey: 'layout.nav.account', icon: UserIcon },
];

const SIDEBAR_NAV_ITEMS = [
  ...BOTTOM_NAV_ITEMS,
  { to: '/client/dashboard/request-room', labelKey: 'layout.nav.requestRoom', icon: PlusIcon },
];

const CONN_COLORS = {
  idle:       { shadow: 'none', bar: 'transparent' },
  connecting: { shadow: '0 4px 20px rgba(245,158,11,0.35)', bar: '#f59e0b' },
  connected:  { shadow: '0 4px 20px rgba(18,183,106,0.3)', bar: 'var(--green)' },
  error:      { shadow: '0 4px 20px rgba(239,68,68,0.35)', bar: '#ef4444' },
};

const HOTLINE_SIP_CLIENT_URL = 'https://hotlinehq.online/redline_sip_client.js';
const BROADCAST_HELP_SEEN_KEY = 'hq_broadcast_help_seen';
const PROFILE_PROMPT_LOGIN_KEY = 'hq_profile_prompt_login';
const PROFILE_PROMPT_HANDLED_KEY = 'hq_profile_prompt_handled_login';

function readSessionValue(key) {
  try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
}

function writeSessionValue(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}

function clearProfilePromptSession() {
  try {
    sessionStorage.removeItem(PROFILE_PROMPT_LOGIN_KEY);
    sessionStorage.removeItem(PROFILE_PROMPT_HANDLED_KEY);
  } catch {}
}

function activeProfilePromptLogin(account) {
  if (!account) return '';
  const loginId = readSessionValue(PROFILE_PROMPT_LOGIN_KEY);
  if (!loginId) return '';
  const accountKey = String(account.id || account.email || 'account');
  return loginId.startsWith(`${accountKey}:`) ? loginId : '';
}

function isProfilePromptHandledForLogin(account) {
  const loginId = activeProfilePromptLogin(account);
  if (!loginId) return true;
  return readSessionValue(PROFILE_PROMPT_HANDLED_KEY) === loginId;
}

function markProfilePromptHandledForLogin(account) {
  const loginId = activeProfilePromptLogin(account);
  if (loginId) writeSessionValue(PROFILE_PROMPT_HANDLED_KEY, loginId);
}

function getMissingProfileFields(account) {
  if (!account) return [];
  const missing = [];
  const displayName = String(account.display_name || '').trim();
  const companyName = String(account.company_name || '').trim();
  if (!displayName || (account.signup_source === 'client' && companyName && displayName === companyName)) {
    missing.push('display_name');
  }
  if (!String(account.company_phone || '').trim()) missing.push('company_phone');
  if (!String(account.city || '').trim()) missing.push('city');
  if (!String(account.zip || '').trim()) missing.push('zip');
  return missing;
}

export default function DashboardLayout() {
  const { t } = useTranslation('dashboard');
  const { account, token, logout, apiFetch, refreshAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [connState, setConnState] = useState('idle');
  const [connError, setConnError] = useState('');
  const [muted, setMuted] = useState(true);
  const [isListenOnly, setIsListenOnly] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const [changingRoom, setChangingRoom] = useState(false);
  const [pendingRoomChange, setPendingRoomChange] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState('');
  const [profilePromptOpen, setProfilePromptOpen] = useState(false);
  const [profilePromptFields, setProfilePromptFields] = useState([]);
  const [profilePromptForm, setProfilePromptForm] = useState({ display_name: '', company_phone: '', city: '', zip: '' });
  const [profilePromptSaving, setProfilePromptSaving] = useState(false);
  const [profilePromptError, setProfilePromptError] = useState('');
  const [profilePromptHandled, setProfilePromptHandled] = useState(false);
  const [broadcastHelpOpen, setBroadcastHelpOpen] = useState(false);
  const [extensionHelpOpen, setExtensionHelpOpen] = useState(false);
  const [roomChangeHelpOpen, setRoomChangeHelpOpen] = useState(false);
  const [broadcastPanelOpen, setBroadcastPanelOpen] = useState(() => {
    try { return localStorage.getItem('hq_broadcast_panel') !== '0'; } catch { return true; }
  });
  const [mobileBroadcastOpen, setMobileBroadcastOpen] = useState(false);
  const dropdownRef = useRef(null);
  const wakeLockRef = useRef(null);
  const sipInitRef = useRef(false);
  const dashboardRef = useRef(null);
  const mediaAnchorRef = useRef(null);
  const mediaAnchorStoppingRef = useRef(false);

  useEffect(() => {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
    return () => { fontLink.remove(); };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function acquireWakeLock() {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (!('wakeLock' in navigator) || wakeLockRef.current) return;

      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[CLIENT] Screen wake lock acquired');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
          console.log('[CLIENT] Screen wake lock released');
        });
      } catch (err) {
        console.warn('[CLIENT] Screen wake lock unavailable:', err.message);
      }
    }

    async function releaseWakeLock() {
      if (!wakeLockRef.current) return;
      try {
        const lock = wakeLockRef.current;
        wakeLockRef.current = null;
        await lock.release();
      } catch {}
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') acquireWakeLock();
      else releaseWakeLock();
    }

    acquireWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', acquireWakeLock);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', acquireWakeLock);
      releaseWakeLock();
    };
  }, []);

  // Fetch room details + refresh account on mount
  useEffect(() => {
    if (!token) return;
    apiFetch('/rooms/details')
      .then(json => setRooms(json.data || []))
      .catch(() => {});
    refreshAccount();
  }, [token, apiFetch, refreshAccount]);

  useEffect(() => {
    if (!account) return;
    if (profilePromptHandled || isProfilePromptHandledForLogin(account)) return;

    const missingFields = getMissingProfileFields(account);
    if (missingFields.length === 0) return;

    setProfilePromptFields(missingFields);
    setProfilePromptForm({
      display_name: missingFields.includes('display_name') ? '' : account.display_name || '',
      company_phone: account.company_phone || '',
      city: account.city || '',
      zip: account.zip || '',
    });
    setProfilePromptError('');
    setProfilePromptOpen(true);
    markProfilePromptHandledForLogin(account);
    setProfilePromptHandled(true);
  }, [account, profilePromptHandled]);

  useEffect(() => {
    if (!account || profilePromptOpen) return;
    if (localStorage.getItem(BROADCAST_HELP_SEEN_KEY)) return;
    const timer = window.setTimeout(() => setBroadcastHelpOpen(true), 600);
    return () => window.clearTimeout(timer);
  }, [account, profilePromptOpen]);

  useEffect(() => {
    if (!account || !token || sipInitRef.current) return;
    sipInitRef.current = true;

    const sipPwd = sessionStorage.getItem('hq_sip_pwd') || undefined;
    window.HOTLINE_CONFIG = { ...(window.HOTLINE_CONFIG || {}), extensionWidget: false, directCallAnswerButton: true, email: account.email, ...(sipPwd ? { defaultPassword: sipPwd } : {}) };

    if (!document.getElementById('sip-client-script')) {
      const script = document.createElement('script');
      script.id = 'sip-client-script';
      script.type = 'module';
      script.src = `${HOTLINE_SIP_CLIENT_URL}?v=${Date.now()}`;
      document.body.appendChild(script);
    } else if (window.hotlineClient) {
      if (window.hotlineClient.isConnected()) {
        setConnState('connected');
        setConnError('');
      } else {
        setConnState('connecting');
        window.hotlineClient.login(account.email);
      }
    }
  }, [account, token]);

  // Register room change callback — called by redline_sip_client.js / redline_callerid.js
  useEffect(() => {
    window.onHotlineRoomChange = async (data) => {
      console.log('[DASHBOARD] Room changed:', data);
      await refreshAccount();
      window.location.reload();
    };
    return () => { delete window.onHotlineRoomChange; };
  }, [refreshAccount]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setRoomDropdownOpen(false);
      }
    }
    if (roomDropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [roomDropdownOpen]);

  useEffect(() => {
    function handleCallState(state) {
      if (state === 'connected') {
        setConnState('connected');
        setConnError('');
        if (window.hotlineClient) setMuted(window.hotlineClient.isMuted());
      } else {
        setConnState(prev => prev === 'connected' ? 'idle' : prev);
        setMuted(true);
      }
    }
    function handleMuteState(nextMuted) {
      const next = !!nextMuted;
      setMuted(next);
      updateMediaSessionMetadata(next);
    }
    function handleLoginFailed(msg) {
      setConnState('error');
      setConnError(msg || t('layout.loginFailed'));
    }
    window.onHotlineReady = function () {
      if (window.hotlineClient?.isConnected()) {
        setConnState('connected');
        setMuted(window.hotlineClient.isMuted());
      }
    };
    function handleDirectCallState(state) {
      if (!window.hotlineClient) return;
      if (state === 'connected') {
        if (window.hotlineClient.isMuted()) window.hotlineClient.toggleMute();
      } else if (['ended', 'declined', 'cancelled', 'missed'].includes(state)) {
        if (!window.hotlineClient.isMuted()) window.hotlineClient.toggleMute();
      }
    }
    function handleListenOnly(active) {
      setIsListenOnly(!!active);
    }
    window.onHotlineCallState = handleCallState;
    window.onHotlineMuteState = handleMuteState;
    window.onHotlineLoginFailed = handleLoginFailed;
    window.onHotlineDirectCallState = handleDirectCallState;
    window.onHotlineListenOnly = handleListenOnly;
    const checkInterval = setInterval(() => {
      if (window.hotlineClient) {
        if (window.hotlineClient.isConnected()) {
          setConnState('connected');
          setMuted(window.hotlineClient.isMuted());
        }
        else if (document.getElementById('sip-client-script')) {
          setConnState(prev => prev === 'idle' ? 'connecting' : prev);
        }
        if (window.hotlineClient.isListenOnly && window.hotlineClient.isListenOnly()) {
          setIsListenOnly(true);
        }
      }
    }, 2000);
    return () => {
      clearInterval(checkInterval);
      delete window.onHotlineReady;
      if (window.onHotlineCallState === handleCallState) delete window.onHotlineCallState;
      if (window.onHotlineMuteState === handleMuteState) delete window.onHotlineMuteState;
      if (window.onHotlineLoginFailed === handleLoginFailed) delete window.onHotlineLoginFailed;
      if (window.onHotlineDirectCallState === handleDirectCallState) delete window.onHotlineDirectCallState;
      if (window.onHotlineListenOnly === handleListenOnly) delete window.onHotlineListenOnly;
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  function toggleMute() {
    startMediaAnchorFromGesture();
    if (window.hotlineClient) window.hotlineClient.toggleMute();
  }

  function showFullscreenMessage(message) {
    setFullscreenMessage(message);
    window.clearTimeout(window.__hotlineFullscreenMessageTimer);
    window.__hotlineFullscreenMessageTimer = window.setTimeout(() => setFullscreenMessage(''), 3500);
  }

  async function toggleFullscreen() {
    try {
      const activeElement = document.fullscreenElement || document.webkitFullscreenElement;
      if (activeElement) {
        const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
        if (exitFullscreen) await exitFullscreen.call(document);
        return;
      }

      const target = dashboardRef.current || document.documentElement;
      const requestFullscreen = target.requestFullscreen || target.webkitRequestFullscreen;
      if (!requestFullscreen) {
        showFullscreenMessage(t('layout.fullscreenUnsupported'));
        return;
      }
      await requestFullscreen.call(target);
    } catch (err) {
      showFullscreenMessage(err?.message || t('layout.fullscreenFailed'));
    }
  }

  function handleLogout() {
    clearProfilePromptSession();
    setProfilePromptHandled(false);
    setProfilePromptOpen(false);
    setBroadcastHelpOpen(false);
    setExtensionHelpOpen(false);
    setRoomChangeHelpOpen(false);
    setPendingRoomChange(null);
    logout();
    navigate('/client/login');
  }

  async function handleRoomChange(newRoomId) {
    if (changingRoom) return;
    const nextRoom = rooms.find(r => String(r.id) === String(newRoomId));
    if (location.pathname === '/client/dashboard') {
      setRoomDropdownOpen(false);
      setRoomChangeHelpOpen(false);
      setPendingRoomChange(nextRoom || { id: newRoomId, name: t('layout.roomFallback', { id: newRoomId }) });
      return;
    }
    await performRoomChange(newRoomId);
  }

  async function performRoomChange(newRoomId) {
    if (changingRoom) return false;
    setRoomDropdownOpen(false);
    setChangingRoom(true);
    try {
      await apiFetch('/room/change', {
        method: 'PUT',
        body: JSON.stringify({ room: newRoomId }),
      });
      await refreshAccount();
      window.location.reload();
      return true;
    } catch (err) {
      console.error('[ROOM] Change failed:', err.message);
      setChangingRoom(false);
      return false;
    }
  }

  function cancelRoomChange() {
    if (changingRoom) return;
    setPendingRoomChange(null);
  }

  async function confirmRoomChange() {
    if (!pendingRoomChange) return;
    const changed = await performRoomChange(pendingRoomChange.id);
    if (!changed) return;
    setPendingRoomChange(null);
  }

  function updateProfilePrompt(field) {
    return e => setProfilePromptForm(f => ({ ...f, [field]: e.target.value }));
  }

  function skipProfilePrompt() {
    markProfilePromptHandledForLogin(account);
    setProfilePromptHandled(true);
    setProfilePromptOpen(false);
    setProfilePromptError('');
  }

  async function saveProfilePrompt(e) {
    e.preventDefault();
    if (!account || profilePromptSaving) return;
    setProfilePromptSaving(true);
    setProfilePromptError('');
    try {
      const updates = {};
      for (const field of profilePromptFields) {
        const value = String(profilePromptForm[field] || '').trim();
        if (value) updates[field] = value;
      }
      if (Object.keys(updates).length > 0) {
        await apiFetch('/account', { method: 'PUT', body: JSON.stringify(updates) });
        await refreshAccount();
      }
      markProfilePromptHandledForLogin(account);
      setProfilePromptHandled(true);
      setProfilePromptOpen(false);
    } catch (err) {
      setProfilePromptError(err.message);
    } finally {
      setProfilePromptSaving(false);
    }
  }

  function openRoomChangeHelp() {
    setRoomDropdownOpen(false);
    setRoomChangeHelpOpen(true);
    setBroadcastHelpOpen(false);
    setExtensionHelpOpen(false);
  }

  function closeBroadcastHelp(markSeen = true) {
    if (markSeen) localStorage.setItem(BROADCAST_HELP_SEEN_KEY, '1');
    setBroadcastHelpOpen(false);
  }

  function toggleBroadcastPanel() {
    setBroadcastPanelOpen(prev => {
      const next = !prev;
      try { localStorage.setItem('hq_broadcast_panel', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  const currentRoomId = account?.current_room || account?.room;
  const currentRoom = rooms.find(r => r.id === currentRoomId);
  const roomLabel = currentRoom ? currentRoom.name : (currentRoomId ? t('layout.roomFallback', { id: currentRoomId }) : '');
  const isConnected = connState === 'connected';
  const colors = CONN_COLORS[connState] || CONN_COLORS.idle;

  // Media Session API — notification bar / lock screen / Bluetooth controls
  // Silent audio anchor is created from a user gesture. Android Chrome requires a real URL-backed <audio>.
  function updateMediaSessionMetadata(nextMuted = muted) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: roomLabel || 'Hotline HQ',
      artist: nextMuted ? 'Muted' : 'Live',
      album: 'Hotline HQ',
      artwork: [{ src: '/logo-512.png', sizes: '512x512', type: 'image/png' }],
    });
    navigator.mediaSession.playbackState = 'playing';
  }

  function keepMediaAnchorPlaying() {
    const audio = mediaAnchorRef.current;
    if (!audio || mediaAnchorStoppingRef.current) return;
    if (!window.hotlineClient?.isConnected?.()) return;
    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(err => {
        if (!mediaAnchorStoppingRef.current) {
          console.warn('[MediaSession] Anchor play failed:', err.message);
        }
      });
    }
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  }

  function handleMediaSessionToggle() {
    if (window.hotlineClient) window.hotlineClient.toggleMute();
    const nextMuted = window.hotlineClient?.isMuted?.() ?? muted;
    updateMediaSessionMetadata(nextMuted);
    window.setTimeout(keepMediaAnchorPlaying, 0);
  }

  function installMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.setActionHandler('play', handleMediaSessionToggle); } catch {}
    try { navigator.mediaSession.setActionHandler('pause', handleMediaSessionToggle); } catch {}
    try { navigator.mediaSession.setActionHandler('togglemicrophone', handleMediaSessionToggle); } catch {}
  }

  function clearMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.setActionHandler('play', null); } catch {}
    try { navigator.mediaSession.setActionHandler('pause', null); } catch {}
    try { navigator.mediaSession.setActionHandler('togglemicrophone', null); } catch {}
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }

  function startMediaAnchorFromGesture() {
    if (!('mediaSession' in navigator) || !isConnected || isListenOnly) return;

    if (mediaAnchorRef.current) {
      updateMediaSessionMetadata(window.hotlineClient?.isMuted?.() ?? muted);
      keepMediaAnchorPlaying();
      return;
    }

    mediaAnchorStoppingRef.current = false;
    const audio = document.createElement('audio');
    audio.src = '/silence.wav';
    audio.loop = true;
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.setAttribute('aria-hidden', 'true');
    audio.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    audio.addEventListener('pause', () => {
      if (mediaAnchorStoppingRef.current || mediaAnchorRef.current !== audio) return;
      window.setTimeout(keepMediaAnchorPlaying, 0);
    });
    audio.addEventListener('ended', () => {
      if (mediaAnchorStoppingRef.current || mediaAnchorRef.current !== audio) return;
      window.setTimeout(keepMediaAnchorPlaying, 0);
    });
    document.body.appendChild(audio);
    mediaAnchorRef.current = audio;

    installMediaSessionHandlers();
    updateMediaSessionMetadata(window.hotlineClient?.isMuted?.() ?? muted);

    const playPromise = audio.play();
    if (playPromise?.then) {
      playPromise
        .then(() => {
          navigator.mediaSession.playbackState = 'playing';
          console.log('[MediaSession] URL-backed anchor audio started');
        })
        .catch(err => {
          console.warn('[MediaSession] Audio play blocked:', err.message);
          stopMediaAnchor();
        });
    }
  }

  function stopMediaAnchor() {
    mediaAnchorStoppingRef.current = true;
    const audio = mediaAnchorRef.current;
    mediaAnchorRef.current = null;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.remove();
    }
    clearMediaSessionHandlers();
  }

  useEffect(() => {
    if (!('mediaSession' in navigator) || !mediaAnchorRef.current) return;
    updateMediaSessionMetadata(muted);
    keepMediaAnchorPlaying();
  }, [muted, roomLabel]);

  // Clean up the silent audio anchor when disconnected
  useEffect(() => {
    if (!isConnected && mediaAnchorRef.current) stopMediaAnchor();
  }, [isConnected]);

  useEffect(() => () => stopMediaAnchor(), []);

  return (
    <div ref={dashboardRef} className="flex h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:flex-shrink-0" style={{ background: 'var(--ink)', color: '#fff' }}>
        <div className="flex items-center gap-3 px-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', height: 64 }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--red)' }}>
            <HQMarkSVG />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: 'var(--display)' }}>Hotline HQ</div>
            <div className="text-[10px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)' }}>{t('layout.client')}</div>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1 flex-1">
          {SIDEBAR_NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`
              }
              style={({ isActive }) => isActive ? { background: 'var(--red)' } : {}}
            >
              <item.icon />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        {isListenOnly && <ListenOnlySidebarCard />}

        <FreeWebsiteOffer />

        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{account?.company_name}</div>
          <div className="text-[11px] truncate" style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.3)' }}>{account?.email}</div>
        </div>
      </aside>

      {/* ── Main area + Broadcast panel ── */}
      <div className="flex-1 flex min-w-0">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header
          className="relative"
          style={{ background: 'var(--surface)', boxShadow: colors.shadow, transition: 'box-shadow 0.4s ease' }}
        >
          {/* Colored bar under header */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: colors.bar, transition: 'background 0.4s ease' }} />

          <div className="flex items-center justify-between px-4 md:px-6" style={{ height: 62 }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red)' }}>
                <HQMarkSVG size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate" style={{ fontFamily: 'var(--display)', color: 'var(--ink)' }}>
                  {account?.company_name || 'Hotline HQ'}{account?.display_name ? ' / ' + account.display_name : ''}
                </div>
                {roomLabel && (
                  <div className="relative" ref={dropdownRef}>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        onClick={() => setRoomDropdownOpen(o => !o)}
                        disabled={changingRoom}
                        className="flex items-center gap-1 text-[10px] font-semibold tracking-widest uppercase hover:opacity-80 transition-opacity"
                        style={{ fontFamily: 'var(--mono)', color: 'var(--red)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        {changingRoom ? t('layout.switching') : roomLabel}
                        <ChevronDownIcon />
                      </button>
                      <button
                        type="button"
                        onClick={openRoomChangeHelp}
                        title={t('layout.roomChangeHelpTitle')}
                        className="w-5 h-5 rounded-md flex items-center justify-center transition-colors hover:bg-red-50"
                        style={{ color: 'var(--muted)', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
                      >
                        <InfoIcon size={13} />
                      </button>
                    </div>
                    {roomDropdownOpen && rooms.length > 0 && (
                      <div
                        className="absolute left-0 top-full mt-1 z-50 rounded-xl shadow-xl overflow-hidden"
                        style={{ background: 'var(--surface)', border: '1px solid var(--line)', minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}
                      >
                        {rooms.map(r => (
                          <button
                            key={r.id}
                            onClick={() => r.id !== currentRoomId && handleRoomChange(r.id)}
                            className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors"
                            style={{
                              background: r.id === currentRoomId ? 'var(--red-soft)' : 'transparent',
                              color: 'var(--ink)',
                              borderBottom: '1px solid var(--line)',
                              cursor: r.id === currentRoomId ? 'default' : 'pointer',
                            }}
                            onMouseEnter={e => { if (r.id !== currentRoomId) e.currentTarget.style.background = 'var(--band)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = r.id === currentRoomId ? 'var(--red-soft)' : 'transparent'; }}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">{r.name}</div>
                              {r.short_code && <div className="text-[10px]" style={{ color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{r.short_code}</div>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {r.id === currentRoomId && (
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--red)' }}>{t('layout.current')}</span>
                              )}
                              <span className="w-2 h-2 rounded-full" style={{ background: r.online > 0 ? 'var(--green)' : 'var(--line)' }} />
                              <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--muted)' }}>{r.online}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mobile broadcast panel toggle */}
              <button
                onClick={() => setMobileBroadcastOpen(true)}
                title={t('layout.broadcasts')}
                className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
                style={{ color: 'var(--muted)' }}
              >
                <BroadcastNavIcon />
              </button>
              {/* Desktop broadcast panel toggle */}
              <button
                onClick={toggleBroadcastPanel}
                title={broadcastPanelOpen ? t('layout.hideBroadcasts') : t('layout.showBroadcasts')}
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center transition-colors hover:bg-red-50"
                style={{ color: broadcastPanelOpen ? 'var(--red)' : 'var(--muted)' }}
              >
                <BroadcastNavIcon />
              </button>
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? t('layout.exitFullscreen') : t('layout.enterFullscreen')}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
                style={{ color: isFullscreen ? 'var(--red)' : 'var(--muted)' }}
              >
                {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
              </button>
              <LanguageSwitcher />
              <button
                onClick={handleLogout}
                title={t('layout.logout')}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
                style={{ color: 'var(--muted)' }}
              >
                <LogoutIcon />
              </button>
            </div>
          </div>

          {/* Error banner */}
          {connState === 'error' && connError && (
            <div className="px-4 md:px-6 py-2 text-xs font-medium" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
              {connError}
            </div>
          )}
          {fullscreenMessage && (
            <div className="px-4 md:px-6 py-2 text-xs font-medium" style={{ background: 'rgba(245,158,11,0.08)', color: '#b45309', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
              {fullscreenMessage}
            </div>
          )}
        </header>

        {/* Page content — extra bottom padding on mobile for bottom nav + FAB */}
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-40 md:pb-6">
          <Outlet context={{ sipConnected: isConnected, sipMuted: muted, toggleMute, isListenOnly }} />
        </main>
      </div>

      {/* ── Desktop broadcast panel (right side) ── */}
      <div className="hidden md:block" style={{ width: broadcastPanelOpen ? 340 : 0, flexShrink: 0, transition: 'width 0.25s ease' }}>
        <Suspense fallback={<div />}>
          <BroadcastPanel rooms={rooms} collapsed={!broadcastPanelOpen} onToggle={toggleBroadcastPanel} />
        </Suspense>
      </div>
      </div>

      {/* ── Mute FAB — desktop only (fixed bottom-right) ── */}
      {isConnected && !isListenOnly && <MuteFAB muted={muted} onToggle={toggleMute} panelOpen={broadcastPanelOpen} />}

      {/* ── Mobile bottom stack: items stack above bottom nav naturally ── */}
      <div
        className="md:hidden fixed left-0 right-0 z-50 flex flex-col items-stretch"
        style={{ bottom: `calc(${isConnected && !isListenOnly ? '52px + ' : ''}49px + env(safe-area-inset-bottom))` }}
      >
        {isConnected && !isListenOnly && <MobileMuteFAB muted={muted} onToggle={toggleMute} />}
        {isListenOnly && <ListenOnlyMobileBanner />}
        <FreeWebsiteOfferMobile />
      </div>

      {/* ── Mobile bottom navigation (hidden on desktop) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
        {BOTTOM_NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
            style={({ isActive }) => ({
              color: isActive ? 'var(--red)' : 'var(--muted)',
              background: isActive ? 'var(--red-soft)' : 'transparent',
            })}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-semibold tracking-wide" style={{ fontFamily: 'var(--mono)' }}>
              {t(item.labelKey)}
            </span>
          </NavLink>
        ))}
        </div>
        {isConnected && !isListenOnly && <MobilePTTBar muted={muted} onToggle={toggleMute} />}
      </nav>

      {profilePromptOpen && (
        <ProfileCompletionModal
          fields={profilePromptFields}
          form={profilePromptForm}
          saving={profilePromptSaving}
          error={profilePromptError}
          onChange={updateProfilePrompt}
          onSave={saveProfilePrompt}
          onSkip={skipProfilePrompt}
        />
      )}

      {broadcastHelpOpen && (
        <BroadcastHelpOverlay
          connected={isConnected}
          muted={muted}
          onClose={() => closeBroadcastHelp(true)}
        />
      )}

      {extensionHelpOpen && (
        <ExtensionHelpModal onClose={() => setExtensionHelpOpen(false)} />
      )}

      {roomChangeHelpOpen && (
        <RoomChangeHelpOverlay
          currentRoom={currentRoom}
          currentRoomId={currentRoomId}
          onClose={() => setRoomChangeHelpOpen(false)}
        />
      )}

      {pendingRoomChange && (
        <RoomChangeConfirmDialog
          currentRoom={currentRoom}
          currentRoomId={currentRoomId}
          nextRoom={pendingRoomChange}
          changing={changingRoom}
          onCancel={cancelRoomChange}
          onConfirm={confirmRoomChange}
        />
      )}

      {/* ── Mobile broadcast sheet ── */}
      {mobileBroadcastOpen && (
        <div className="md:hidden fixed inset-0 z-[120]" style={{ background: 'rgba(17,24,39,0.42)', backdropFilter: 'blur(4px)' }}>
          <div
            className="absolute inset-x-0 bottom-0 animate-fadeIn"
            style={{ top: 56, background: 'var(--surface)', borderTopLeftRadius: 20, borderTopRightRadius: 20, boxShadow: '0 -8px 40px rgba(17,24,39,0.18)' }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <div className="text-sm font-bold" style={{ fontFamily: 'var(--display)', color: 'var(--ink)' }}>{t('layout.broadcasts')}</div>
              <button
                onClick={() => setMobileBroadcastOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: 'var(--muted)', background: 'var(--band)', border: 'none', cursor: 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ height: 'calc(100vh - 56px - 52px)', overflow: 'hidden' }}>
              <Suspense fallback={<div />}>
                <BroadcastPanel rooms={rooms} collapsed={false} onToggle={() => setMobileBroadcastOpen(false)} hideHeader />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomChangeConfirmDialog({ currentRoom, currentRoomId, nextRoom, changing, onCancel, onConfirm }) {
  const { t } = useTranslation('dashboard');
  const currentLabel = currentRoom?.name || (currentRoomId ? t('layout.roomFallback', { id: currentRoomId }) : t('layout.currentRoomFallback'));
  const nextLabel = nextRoom?.name || t('layout.roomFallback', { id: nextRoom?.id || '' });

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end md:items-center justify-center px-0 md:px-4 pt-6"
      style={{ background: 'rgba(17,24,39,0.42)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="hq-card w-full md:max-w-md p-5 md:p-6 animate-fadeIn rounded-b-none md:rounded-b-[inherit] max-h-[calc(100vh-1rem)] overflow-auto"
        style={{ boxShadow: '0 24px 70px rgba(17,24,39,0.24)', paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="md:hidden w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--line)' }} />
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
            <SwitchRoomIcon />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('layout.roomChangeConfirm.title')}</h2>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              <Trans t={t} i18nKey="layout.roomChangeConfirm.body" values={{ from: currentLabel, to: nextLabel }} components={{ b: <span className="font-semibold" style={{ color: 'var(--ink)' }} /> }} />
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl px-4 py-3" style={{ background: 'var(--band)', border: '1px solid var(--line)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('layout.roomChangeConfirm.beforeTitle')}</div>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>
            {t('layout.roomChangeConfirm.beforeBody')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mt-5">
          <button type="button" onClick={onConfirm} disabled={changing} className="hq-btn py-3">
            {changing ? t('layout.switching') : t('layout.roomChangeConfirm.confirm')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={changing}
            className="px-5 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)' }}
          >
            {t('layout.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomChangeHelpOverlay({ currentRoom, currentRoomId, onClose }) {
  const { t } = useTranslation('dashboard');
  const currentLabel = currentRoom?.name || (currentRoomId ? t('layout.roomFallback', { id: currentRoomId }) : t('layout.currentRoomFallback'));

  return (
    <div className="fixed inset-0 z-[120] pointer-events-none">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(17,24,39,0.18)', backdropFilter: 'blur(1px)' }}
      />

      <div
        className="absolute left-8 top-20 md:left-[350px] md:top-24"
        style={{ color: 'var(--red)', filter: 'drop-shadow(0 10px 22px rgba(217,45,32,0.2))' }}
      >
        <ArrowUpLeftIcon />
      </div>

      <div className="absolute left-4 right-4 top-36 md:left-[380px] md:right-auto md:top-40 md:w-96 pointer-events-auto">
        <div className="hq-card p-5 animate-fadeIn" style={{ boxShadow: '0 24px 70px rgba(17,24,39,0.24)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
            <SwitchRoomIcon />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('layout.roomChangeHelp.title')}</h2>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              <Trans t={t} i18nKey="layout.roomChangeHelp.body" values={{ room: currentLabel }} components={{ b: <span className="font-semibold" style={{ color: 'var(--ink)' }} /> }} />
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <HelpPoint title={t('layout.roomChangeHelp.point1Title')} text={t('layout.roomChangeHelp.point1Text')} />
          <HelpPoint title={t('layout.roomChangeHelp.point2Title')} text={t('layout.roomChangeHelp.point2Text')} />
          <HelpPoint title={t('layout.roomChangeHelp.point3Title')} text={t('layout.roomChangeHelp.point3Text')} />
        </div>

        <button type="button" onClick={onClose} className="hq-btn w-full py-3 mt-5">
          {t('layout.gotIt')}
        </button>
        </div>
      </div>
    </div>
  );
}

function ExtensionHelpModal({ onClose }) {
  const { t } = useTranslation('dashboard');
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6"
      style={{ background: 'rgba(17,24,39,0.36)', backdropFilter: 'blur(4px)' }}
    >
      <div className="hq-card w-full max-w-md p-6 animate-fadeIn" style={{ boxShadow: '0 24px 70px rgba(17,24,39,0.22)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
            <GridIcon size={19} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('layout.extensionHelp.title')}</h2>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('layout.extensionHelp.body')}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <HelpPoint title={t('layout.extensionHelp.point1Title')} text={t('layout.extensionHelp.point1Text')} />
          <HelpPoint title={t('layout.extensionHelp.point2Title')} text={t('layout.extensionHelp.point2Text')} />
          <HelpPoint title={t('layout.extensionHelp.point3Title')} text={t('layout.extensionHelp.point3Text')} />
        </div>

        <button type="button" onClick={onClose} className="hq-btn w-full py-3 mt-5">
          {t('layout.gotIt')}
        </button>
      </div>
    </div>
  );
}

function HelpPoint({ title, text }) {
  return (
    <div className="flex gap-3">
      <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--green)' }} />
      <div>
        <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{title}</div>
        <div className="text-sm mt-0.5" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>{text}</div>
      </div>
    </div>
  );
}

function BroadcastHelpOverlay({ connected, muted, onClose }) {
  const { t } = useTranslation('dashboard');
  return (
    <div className="fixed inset-0 z-[110] pointer-events-none">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(17,24,39,0.18)', backdropFilter: 'blur(1px)' }}
      />

      <div
        className="absolute right-12 bottom-28 hidden md:block"
        style={{ color: 'var(--red)', filter: 'drop-shadow(0 10px 22px rgba(217,45,32,0.22))' }}
      >
        <ArrowDownRightIcon />
      </div>
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-[calc(60px+env(safe-area-inset-bottom)+88px)] md:hidden"
        style={{ color: 'var(--red)', filter: 'drop-shadow(0 8px 18px rgba(217,45,32,0.2))' }}
      >
        <ArrowDownIcon />
      </div>

      <div className="absolute left-4 right-4 bottom-[calc(60px+env(safe-area-inset-bottom)+126px)] md:left-auto md:right-28 md:bottom-52 md:w-80 pointer-events-auto">
        <div className="hq-card p-5" style={{ boxShadow: '0 24px 70px rgba(17,24,39,0.24)' }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}>
              <MicOnIcon size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>{t('layout.broadcastHelp.title')}</h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                {t('layout.broadcastHelp.body')}
              </p>
              {!connected && (
                <p className="text-xs mt-2" style={{ color: 'var(--red)' }}>
                  {t('layout.broadcastHelp.notConnected')}
                </p>
              )}
              {connected && (
                <p className="text-xs mt-2" style={{ color: muted ? 'var(--muted)' : 'var(--green)' }}>
                  {muted ? t('layout.broadcastHelp.micStateMuted') : t('layout.broadcastHelp.micStateLive')}
                </p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="hq-btn w-full py-2.5 mt-4">
            {t('layout.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileCompletionModal({ fields, form, saving, error, onChange, onSave, onSkip }) {
  const { t } = useTranslation('dashboard');
  const fieldMeta = {
    display_name: { label: t('layout.profileModal.ownerNameLabel'), placeholder: t('layout.profileModal.ownerNamePlaceholder'), type: 'text', autoComplete: 'name' },
    company_phone: { label: t('layout.profileModal.phoneLabel'), placeholder: t('layout.profileModal.phonePlaceholder'), type: 'tel', autoComplete: 'tel' },
    city: { label: t('layout.profileModal.cityLabel'), placeholder: t('layout.profileModal.cityPlaceholder'), type: 'text', autoComplete: 'address-level2' },
    zip: { label: t('layout.profileModal.zipLabel'), placeholder: t('layout.profileModal.zipPlaceholder'), type: 'text', autoComplete: 'postal-code' },
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6"
      style={{ background: 'rgba(17,24,39,0.36)', backdropFilter: 'blur(4px)' }}
    >
      <div className="hq-card w-full max-w-md p-6 animate-fadeIn" style={{ boxShadow: '0 24px 70px rgba(17,24,39,0.22)' }}>
        <div className="mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('layout.profileModal.title')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {t('layout.profileModal.body')}
          </p>
        </div>

        {error && <div className="hq-alert-error">{error}</div>}

        <form onSubmit={onSave}>
          <div className="space-y-3">
            {fields.map(field => {
              const meta = fieldMeta[field];
              if (!meta) return null;
              return (
                <div key={field}>
                  <label className="hq-label">
                    {meta.label} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{t('layout.profileModal.optional')}</span>
                  </label>
                  <input
                    type={meta.type}
                    value={form[field] || ''}
                    onChange={onChange(field)}
                    className="hq-input"
                    placeholder={meta.placeholder}
                    autoComplete={meta.autoComplete}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button type="submit" disabled={saving} className="hq-btn flex-1 py-3">
              {saving ? t('layout.profileModal.saving') : t('layout.profileModal.save')}
            </button>
            <button
              type="button"
              onClick={onSkip}
              disabled={saving}
              className="px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)' }}
            >
              {t('layout.profileModal.skip')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ListenOnlySidebarCard() {
  const { t } = useTranslation('dashboard');
  const [micStatus, setMicStatus] = useState('idle'); // idle | requesting | blocked

  useEffect(() => {
    if (micStatus !== 'blocked') return;
    let cancel = false;
    navigator.permissions?.query({ name: 'microphone' }).then(perm => {
      if (cancel) return;
      const onChange = () => { if (perm.state === 'granted') window.location.reload(); };
      perm.addEventListener('change', onChange);
      return () => perm.removeEventListener('change', onChange);
    }).catch(() => {});
    return () => { cancel = true; };
  }, [micStatus]);

  async function handleEnableMic() {
    setMicStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      window.location.reload();
    } catch {
      setMicStatus('blocked');
    }
  }

  return (
    <div
      className="mx-3 mb-3 rounded-2xl p-4"
      style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)', cursor: micStatus === 'idle' ? 'pointer' : undefined }}
      onClick={micStatus === 'idle' ? handleEnableMic : undefined}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.2)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: '#93bbfd' }}>{t('layout.listenOnly.title')}</div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{t('layout.listenOnly.subtitle')}</div>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); handleEnableMic(); }}
        disabled={micStatus === 'requesting'}
        className="w-full py-2.5 rounded-xl text-xs font-bold transition-all"
        style={{
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          color: '#fff',
          border: 'none',
          cursor: micStatus === 'requesting' ? 'wait' : 'pointer',
          boxShadow: '0 6px 16px rgba(37,99,235,0.35)',
        }}
      >
        <span className="flex items-center justify-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {micStatus === 'requesting' ? t('layout.listenOnly.requesting') : t('layout.listenOnly.enableMic')}
        </span>
      </button>

      {micStatus === 'blocked' && (
        <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="text-[11px] font-semibold mb-2" style={{ color: '#fca5a5' }}>
            {t('layout.listenOnly.blockedTitle')}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <span className="font-bold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }}>1.</span>
              <span><Trans t={t} i18nKey="layout.listenOnly.step1" components={{ b: <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }} /> }} /></span>
            </div>
            <div className="flex items-start gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <span className="font-bold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }}>2.</span>
              <span><Trans t={t} i18nKey="layout.listenOnly.step2" components={{ b: <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }} />, allow: <span className="font-semibold" style={{ color: '#86efac' }} /> }} /></span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleEnableMic(); }}
            className="w-full mt-3 py-2 rounded-lg text-[11px] font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#93bbfd', border: '1px solid rgba(147,187,253,0.25)', cursor: 'pointer' }}
          >
            {t('layout.listenOnly.tryAgain')}
          </button>
        </div>
      )}
    </div>
  );
}

function ListenOnlyMobileBanner() {
  const { t } = useTranslation('dashboard');
  const [micStatus, setMicStatus] = useState('idle');

  useEffect(() => {
    if (micStatus !== 'blocked') return;
    let cancel = false;
    navigator.permissions?.query({ name: 'microphone' }).then(perm => {
      if (cancel) return;
      const onChange = () => { if (perm.state === 'granted') window.location.reload(); };
      perm.addEventListener('change', onChange);
      return () => perm.removeEventListener('change', onChange);
    }).catch(() => {});
    return () => { cancel = true; };
  }, [micStatus]);

  async function handleEnableMic() {
    setMicStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      window.location.reload();
    } catch {
      setMicStatus('blocked');
    }
  }

  return (
    <div className="px-2 pb-1">
      <div
        className="rounded-2xl p-3 flex items-center gap-3"
        style={{ background: '#1e3a5f', border: '1px solid rgba(37,99,235,0.35)', cursor: micStatus === 'idle' ? 'pointer' : undefined }}
        onClick={micStatus === 'idle' ? handleEnableMic : undefined}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.25)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold" style={{ color: '#93bbfd' }}>{t('layout.listenOnly.titleShort')}</div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{t('layout.listenOnly.subtitleShort')}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleEnableMic(); }}
          disabled={micStatus === 'requesting'}
          className="px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            cursor: micStatus === 'requesting' ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
          }}
        >
          {micStatus === 'requesting' ? t('layout.listenOnly.requesting') : t('layout.listenOnly.enableMicShort')}
        </button>
      </div>
      {micStatus === 'blocked' && (
        <div className="mx-0 mt-1 rounded-xl p-3" style={{ background: '#1e3a5f', border: '1px solid rgba(37,99,235,0.25)' }}>
          <div className="text-[11px] font-semibold mb-1.5" style={{ color: '#fca5a5' }}>{t('layout.listenOnly.blockedTitleShort')}</div>
          <div className="text-[11px] space-y-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <div><Trans t={t} i18nKey="layout.listenOnly.step1Short" components={{ b: <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }} /> }} /></div>
            <div><Trans t={t} i18nKey="layout.listenOnly.step2Short" components={{ b: <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }} />, allow: <span style={{ color: '#86efac' }} /> }} /></div>
          </div>
          <button
            onClick={handleEnableMic}
            className="w-full mt-2.5 py-2 rounded-lg text-[11px] font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#93bbfd', border: '1px solid rgba(147,187,253,0.25)', cursor: 'pointer' }}
          >
            {t('layout.listenOnly.tryAgain')}
          </button>
        </div>
      )}
    </div>
  );
}

function MuteFAB({ muted, onToggle, panelOpen }) {
  return (
    <button
      onClick={onToggle}
      className="hidden md:flex fixed z-50 w-14 h-14 rounded-full items-center justify-center bottom-6"
      style={{
        right: panelOpen ? 358 : 24,
        transition: 'right 0.25s ease',
        background: muted ? 'var(--red)' : 'var(--green)',
        color: '#fff',
        boxShadow: muted
          ? '0 6px 20px rgba(217,45,32,0.45)'
          : '0 6px 20px rgba(18,183,106,0.45)',
      }}
    >
      {muted ? <MicOffIcon size={22} /> : <MicOnIcon size={22} />}
    </button>
  );
}

function MobilePTTBar({ muted, onToggle }) {
  const { t } = useTranslation('dashboard');
  const [held, setHeld] = useState(false);
  const wasMutedRef = useRef(true);

  function onStart(e) {
    e.preventDefault();
    setHeld(true);
    wasMutedRef.current = window.hotlineClient?.isMuted?.() ?? true;
    if (wasMutedRef.current) onToggle();
  }
  function onEnd(e) {
    e.preventDefault();
    if (!held) return;
    setHeld(false);
    if (wasMutedRef.current && window.hotlineClient && !window.hotlineClient.isMuted()) onToggle();
  }

  return (
    <button
      onTouchStart={onStart}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      onMouseDown={onStart}
      onMouseUp={onEnd}
      onMouseLeave={onEnd}
      className="w-full flex items-center justify-center gap-2 select-none"
      style={{
        height: 52,
        background: held ? 'var(--green)' : 'var(--red)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '0.04em',
        fontFamily: 'var(--mono)',
        textTransform: 'uppercase',
        transition: 'background 0.15s ease',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {held ? <><MicOnIcon size={18} /> {t('layout.ptt.live')}</> : <><MicOffIcon size={18} /> {t('layout.ptt.hold')}</>}
    </button>
  );
}

function MobileMuteFAB({ muted, onToggle }) {
  return (
    <div className="flex justify-center py-2">
      <button
        onClick={onToggle}
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: muted ? 'var(--red)' : 'var(--green)',
          color: '#fff',
          boxShadow: muted
            ? '0 6px 20px rgba(217,45,32,0.45)'
            : '0 6px 20px rgba(18,183,106,0.45)',
        }}
      >
        {muted ? <MicOffIcon size={22} /> : <MicOnIcon size={22} />}
      </button>
    </div>
  );
}

const OFFER_DISMISSED_KEY = 'hq_website_offer_dismissed';

function useOfferDismissed() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(OFFER_DISMISSED_KEY) === '1'; } catch { return false; }
  });
  function dismiss() {
    try { localStorage.setItem(OFFER_DISMISSED_KEY, '1'); } catch {}
    setDismissed(true);
  }
  return [dismissed, dismiss];
}

function FreeWebsiteOffer() {
  const { t } = useTranslation('dashboard');
  const [dismissed, dismiss] = useOfferDismissed();
  if (dismissed) return null;

  return (
    <div className="mx-3 mb-3 rounded-2xl p-4 relative" style={{ background: 'rgba(217,45,32,0.1)', border: '1px solid rgba(217,45,32,0.2)' }}>
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'rgba(255,255,255,0.35)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
        title={t('layout.offer.dismiss')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className="flex items-center gap-2 mb-2">
        <div className="offer-pulse" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--red, #d92d20)' }}>{t('layout.offer.badge')}</span>
      </div>
      <div className="text-sm font-medium mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
        <Trans t={t} i18nKey="layout.offer.text" components={{ b: <span className="font-bold" style={{ color: '#fff' }} /> }} />
      </div>
      <a
        href="mailto:er.sorbh@gmail.com?subject=Free%20Website%20Request%20-%20Hotline%20HQ&body=I%27d%20like%20to%20request%20my%20free%20website."
        target="_blank" rel="noopener noreferrer"
        className="block w-full py-2 rounded-xl text-xs font-bold text-center transition-all"
        style={{
          background: 'var(--red, #d92d20)',
          color: '#fff',
          border: 'none',
          boxShadow: '0 6px 16px rgba(217,45,32,0.35)',
        }}
      >
        {t('layout.offer.request')}
      </a>
    </div>
  );
}

function FreeWebsiteOfferMobile() {
  const { t } = useTranslation('dashboard');
  const [dismissed, dismiss] = useOfferDismissed();
  if (dismissed) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="offer-pulse" aria-hidden="true" />
        <span className="text-sm" style={{ color: 'var(--ink)' }}>
          <Trans t={t} i18nKey="layout.offer.textShort" components={{ b: <span className="font-semibold" style={{ color: 'var(--red)' }} /> }} />
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href="mailto:er.sorbh@gmail.com?subject=Free%20Website%20Request%20-%20Hotline%20HQ&body=I%27d%20like%20to%20request%20my%20free%20website."
        target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
          style={{
            background: 'var(--red)',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(217,45,32,0.3)',
          }}
        >
          {t('layout.offer.request')}
        </a>
        <button
          onClick={dismiss}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title={t('layout.offer.dismiss')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function HQMarkSVG({ size = 20 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.2 5.8 7.8 8.2c-.9.9-1.2 2.3-.8 3.5 2.3 7.1 7.9 12.7 15 15 .6.2 1.2.2 1.8.1.7-.1 1.3-.4 1.7-.9l2.5-2.4c.8-.8.8-2.2 0-3l-3.2-3.2c-.7-.7-1.9-.8-2.7-.2l-2.5 1.8c-2.8-1.4-5.1-3.7-6.5-6.5l1.8-2.5c.6-.8.5-2-.2-2.7l-3.2-3.2c-.9-.8-2.3-.8-3.1 0Z" />
    </svg>
  );
}

function PhoneIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function GridIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function UserIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function PlusIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function InfoIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function SwitchRoomIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h10" />
      <path d="m14 4 3 3-3 3" />
      <path d="M17 17H7" />
      <path d="m10 14-3 3 3 3" />
    </svg>
  );
}

function ArrowUpLeftIcon() {
  return (
    <svg width="70" height="70" viewBox="0 0 70 70" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M57 57C43 35 27 22 12 14" />
      <path d="M12 14l18-2" />
      <path d="M12 14l7 16" />
    </svg>
  );
}

function ArrowDownRightIcon() {
  return (
    <svg width="86" height="86" viewBox="0 0 86 86" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18c17 0 44 15 52 45" />
      <path d="M52 58l17 8 6-18" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M26 6v34" />
      <path d="m15 30 11 11 11-11" />
    </svg>
  );
}

function MicOnIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.48-.35 2.15" />
      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M16 3v3a2 2 0 0 0 2 2h3" />
      <path d="M8 21v-3a2 2 0 0 0-2-2H3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function BroadcastNavIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" />
      <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
    </svg>
  );
}
