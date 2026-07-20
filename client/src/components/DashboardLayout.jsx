import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Toaster, toast } from 'sonner';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LanguageSwitcher from './LanguageSwitcher';
import { LANGUAGES } from '../i18n';
import { loadSupportgram } from '../lib/supportgram';

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
  const { t, i18n } = useTranslation('dashboard');
  const { account, token, logout, apiFetch, refreshAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [connState, setConnState] = useState('idle');
  const [connError, setConnError] = useState('');
  const [muted, setMuted] = useState(true);
  const [isListenOnly, setIsListenOnly] = useState(false);
  const [isMonitorMode, setIsMonitorMode] = useState(false);
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
  const [extensionHelpOpen, setExtensionHelpOpen] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [yealinkOnline, setYealinkOnline] = useState(false);
  const [yealinkLostOpen, setYealinkLostOpen] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [yealinkBackOpen, setYealinkBackOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [broadcastPanelOpen, setBroadcastPanelOpen] = useState(() => {
    try { return localStorage.getItem('hq_broadcast_panel') !== '0'; } catch { return true; }
  });
  const [mobileBroadcastOpen, setMobileBroadcastOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const moreMenuRef = useRef(null);
  const wakeLockRef = useRef(null);
  const sipInitRef = useRef(false);
  const dashboardRef = useRef(null);

  useEffect(() => {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
    return () => { fontLink.remove(); };
  }, []);

  useEffect(() => {
    if (!account?.email) return;
    loadSupportgram({ name: account.display_name || account.email, email: account.email });
  }, [account?.email, account?.display_name]);

  useEffect(() => {
    let cancelled = false;
    let noSleepVideo = null;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    async function acquireWakeLock() {
      if (cancelled || document.visibilityState !== 'visible') return;

      if ('wakeLock' in navigator && !wakeLockRef.current) {
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

      if (isIOS && !noSleepVideo) {
        noSleepVideo = document.createElement('video');
        noSleepVideo.setAttribute('playsinline', '');
        noSleepVideo.setAttribute('muted', '');
        noSleepVideo.muted = true;
        noSleepVideo.loop = true;
        noSleepVideo.style.cssText = 'position:fixed;top:-1px;left:-1px;width:1px;height:1px;opacity:0.01';
        // tiny silent mp4 (base64) — triggers media playback to prevent iOS auto-lock
        noSleepVideo.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA+NtZGF0AAACrwYF//+r3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCAzMWUxOWY5IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAATWWIhAAh//73Tv+Bh0AAALS4ry4sOAAAAwAAAwAABLqTiTd4wA7y5ABhHPb6MkIBG38MAAP/Al83PlMAAAADAAADAAADAAADAAADABACAAAAGUGaJGxBD5B+v+cAAAADAAADAAADAWmAAHdAAAAUQZ5CeIX/AAAMB9bHJAADAAALcQAAABEBnmF0R/8AAAMAhZAAAAsRAAAAEQGeY2pH/wAAAwCFkAAAC3EAAAAhQZpoSahBaJlMCE///fEAAAMAAEgANAAAAwAAAwABjwAAABFBnoZFESwn/wAAAwCFkAAAC3EAAAARAZ+ldEf/AAADAIWQAAALEQAAABEBn6dqR/8AAAMAhZAAAAtxAAAAFkGbrEmoQWyZTBRME//98QAAAwAABz0AAAATAZ/LdEf/AAADAAADAAALEUAAABITAZ/NagAAAwAAAwAAAwAACxAAAAKTbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAACgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAdR0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAACgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAARAAAAAAACWG1kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAKAAAAACVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABqm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAWpzdGJsAAAAlnN0c2QAAAAAAAAAAQAAAIZhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEQBIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAANGhdY0QBSsAB7f+QAACIAAIuuALAYYB5oQAAAwABAAADAAIPEiWWAQAFaO8wLJgAAAAYc3R0cwAAAAAAAAABAAAAAgAAQAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAgAAAAEAAAAcc3RzegAAAAAAAAAAAAAAAgAAA+sAAAAMAAAAFHN0Y28AAAAAAAAAAQAAADAAAAACAAAALWAAAB10c2MAAAAAJgAAAAEAAAAHAAAA/////wAAAAIAABsAAABzAAAAACB1ZHRhAAAAGG1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAAAAAA==';
        document.body.appendChild(noSleepVideo);
        noSleepVideo.play().then(() => {
          console.log('[CLIENT] iOS no-sleep video playing');
        }).catch(() => {});
      }
    }

    async function releaseWakeLock() {
      if (wakeLockRef.current) {
        try {
          const lock = wakeLockRef.current;
          wakeLockRef.current = null;
          await lock.release();
        } catch {}
      }
      if (noSleepVideo) {
        noSleepVideo.pause();
        noSleepVideo.remove();
        noSleepVideo = null;
      }
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

  // Prevent iOS overscroll bounce
  useEffect(() => {
    const mainEl = dashboardRef.current?.querySelector('main');
    if (!mainEl) return;

    function preventOverscroll(e) {
      const el = mainEl;
      const top = el.scrollTop;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) { e.preventDefault(); return; }
      if (top <= 0 && e.touches[0].clientY > (el._lastTouchY || 0)) { e.preventDefault(); }
      else if (top >= max && e.touches[0].clientY < (el._lastTouchY || 0)) { e.preventDefault(); }
      el._lastTouchY = e.touches[0].clientY;
    }
    function trackTouch(e) { mainEl._lastTouchY = e.touches[0].clientY; }

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    mainEl.addEventListener('touchstart', trackTouch, { passive: true });
    mainEl.addEventListener('touchmove', preventOverscroll, { passive: false });

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      mainEl.removeEventListener('touchstart', trackTouch);
      mainEl.removeEventListener('touchmove', preventOverscroll);
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
    if (!account || !token || sipInitRef.current) return;
    sipInitRef.current = true;

    const sipPwd = sessionStorage.getItem('hq_sip_pwd') || undefined;
    window.HOTLINE_CONFIG = { ...(window.HOTLINE_CONFIG || {}), extensionWidget: false, directCallAnswerButton: true, broadcastFeed: true, email: account.email, ...(sipPwd ? { password: sipPwd } : { token }) };

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

  // Seed the desk-phone indicator from the account payload; SSE keeps it live
  useEffect(() => {
    if (account) setYealinkOnline(!!account.yealink_online);
  }, [account]);

  // Register room change callback — called by redline_sip_client.js / redline_callerid.js
  useEffect(() => {
    window.onHotlineRoomChange = async (data) => {
      // No reload: the SIP client keeps its session and rebinds its SSE to the
      // new room; refreshing the account context re-renders everything
      // room-dependent (BroadcastPanel feed, room name, online counts).
      console.log('[DASHBOARD] Room changed:', data);
      await refreshAccount();
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
    function handleClick(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreMenuOpen(false);
    }
    if (moreMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreMenuOpen]);

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
    }
    function handleLoginFailed(msg) {
      setConnState('error');
      setConnError(msg || t('layout.loginFailed'));
    }
    function handleHotlineError(err) {
      // 401 from the SIP client's login/account fetch = dead session (expired
      // token or deleted account) — same exit as apiFetch's TOKEN_EXPIRED path.
      if (err?.status === 401) {
        logout();
        window.location.replace('/client/login?session=expired');
      }
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
    function handleMonitorMode(active) {
      setIsMonitorMode(!!active);
    }
    function handleUserLogout() {
      logout();
      navigate('/client/login?session=replaced');
    }
    function handleKickout(data) {
      if (data?.kickout) {
        toast.error(data.reason || 'You have been removed from the hotline by an administrator', { duration: 10000 });
      } else {
        toast.success(data?.reason || 'Your hotline access has been restored', { duration: 10000 });
      }
    }
    function handleDeviceStatus(data) {
      const online = !!data?.yealink_online;
      setYealinkOnline(online);
      // Yealink came back while the disconnect modal is up — nothing to decide;
      // Yealink dropped again while the release modal is up — nothing to release to.
      if (online) setYealinkLostOpen(false);
      else setYealinkBackOpen(false);
    }
    function handleYealinkLost() {
      setYealinkOnline(false);
      try { if (localStorage.getItem('hq_yealink_lost_dismiss') === '1') return; } catch {}
      setYealinkLostOpen(true);
    }
    function handleYealinkAvailable() {
      setYealinkOnline(true);
      try { if (localStorage.getItem('hq_yealink_back_dismiss') === '1') return; } catch {}
      setYealinkBackOpen(true);
    }
    window.onHotlineCallState = handleCallState;
    window.onHotlineMuteState = handleMuteState;
    window.onHotlineLoginFailed = handleLoginFailed;
    window.onHotlineError = handleHotlineError;
    window.onHotlineDirectCallState = handleDirectCallState;
    window.onHotlineListenOnly = handleListenOnly;
    window.onHotlineMonitorMode = handleMonitorMode;
    window.onHotlineUserLogout = handleUserLogout;
    window.onHotlineKickout = handleKickout;
    window.onHotlineDeviceStatus = handleDeviceStatus;
    window.onHotlineYealinkLost = handleYealinkLost;
    window.onHotlineYealinkAvailable = handleYealinkAvailable;
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
        if (window.hotlineClient.isMonitorMode) {
          setIsMonitorMode(window.hotlineClient.isMonitorMode());
        }
      }
    }, 2000);
    return () => {
      clearInterval(checkInterval);
      delete window.onHotlineReady;
      if (window.onHotlineCallState === handleCallState) delete window.onHotlineCallState;
      if (window.onHotlineMuteState === handleMuteState) delete window.onHotlineMuteState;
      if (window.onHotlineLoginFailed === handleLoginFailed) delete window.onHotlineLoginFailed;
      if (window.onHotlineError === handleHotlineError) delete window.onHotlineError;
      if (window.onHotlineDirectCallState === handleDirectCallState) delete window.onHotlineDirectCallState;
      if (window.onHotlineListenOnly === handleListenOnly) delete window.onHotlineListenOnly;
      if (window.onHotlineMonitorMode === handleMonitorMode) delete window.onHotlineMonitorMode;
      if (window.onHotlineUserLogout === handleUserLogout) delete window.onHotlineUserLogout;
      if (window.onHotlineKickout === handleKickout) delete window.onHotlineKickout;
      if (window.onHotlineDeviceStatus === handleDeviceStatus) delete window.onHotlineDeviceStatus;
      if (window.onHotlineYealinkLost === handleYealinkLost) delete window.onHotlineYealinkLost;
      if (window.onHotlineYealinkAvailable === handleYealinkAvailable) delete window.onHotlineYealinkAvailable;
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
    setExtensionHelpOpen(false);
    setPendingRoomChange(null);
    logout();
    navigate('/client/login');
  }

  async function confirmWebTakeover() {
    if (takingOver) return;
    setTakingOver(true);
    try {
      await window.hotlineClient?.takeOver?.();
      setYealinkLostOpen(false);
      toast.success(t('layout.yealinkLost.tookOver', 'You are connected from the browser'));
    } catch (err) {
      toast.error(err?.message || t('layout.yealinkLost.takeOverFailed', 'Takeover failed'));
    } finally {
      setTakingOver(false);
    }
  }

  async function confirmReleaseToPhone() {
    if (releasing) return;
    setReleasing(true);
    try {
      await window.hotlineClient?.releaseTakeover?.();
      setYealinkBackOpen(false);
      toast.success(t('layout.yealinkBack.released', 'Call moved to your desk phone'));
    } catch (err) {
      toast.error(err?.message || t('layout.yealinkBack.releaseFailed', 'Release failed'));
    } finally {
      setReleasing(false);
    }
  }

  async function handleRoomChange(newRoomId) {
    if (changingRoom) return;
    const nextRoom = rooms.find(r => String(r.id) === String(newRoomId));
    if (location.pathname === '/client/dashboard') {
      setRoomDropdownOpen(false);
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
  const monitorColors = { shadow: '0 4px 20px rgba(37,99,235,0.3)', bar: '#2563eb' };
  const colors = isMonitorMode ? monitorColors : (CONN_COLORS[connState] || CONN_COLORS.idle);

  return (
    <div ref={dashboardRef} className="flex h-screen" style={{ background: 'var(--bg)', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      <Toaster position="top-center" richColors />
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:flex-shrink-0" style={{ background: 'var(--ink)', color: '#fff' }}>
        <div className="flex items-center gap-3 px-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', height: 64 }}>
          <HQMarkSVG size={36} />
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
              {/* Yealink desk phone status — only for YMCS-linked accounts */}
              {!!account?.has_yealink && (
                <div
                  title={yealinkOnline
                    ? t('layout.deskPhoneOnline', 'Yealink desk phone connected')
                    : t('layout.deskPhoneOffline', 'Yealink desk phone offline')}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg"
                  style={{ border: '1px solid var(--line)', color: yealinkOnline ? 'var(--ink)' : 'var(--muted)' }}
                >
                  <PhoneIcon size={13} />
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: yealinkOnline ? 'var(--green)' : '#9ca3af', boxShadow: yealinkOnline ? '0 0 0 3px rgba(18,183,106,0.15)' : 'none' }}
                  />
                  <span className="hidden md:inline text-[9px] font-bold tracking-widest uppercase" style={{ fontFamily: 'var(--mono)' }}>
                    {t('layout.deskPhone', 'Yealink')}
                  </span>
                </div>
              )}
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
              {/* Desktop: show all actions inline */}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? t('layout.exitFullscreen') : t('layout.enterFullscreen')}
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center transition-colors hover:bg-red-50"
                style={{ color: isFullscreen ? 'var(--red)' : 'var(--muted)' }}
              >
                {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
              </button>
              <div className="hidden md:block"><LanguageSwitcher /></div>
              <button
                onClick={handleLogout}
                title={t('layout.logout')}
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center transition-colors hover:bg-red-50"
                style={{ color: 'var(--muted)' }}
              >
                <LogoutIcon />
              </button>
              {/* Mobile: overflow menu for fullscreen, language, logout */}
              <div className="relative md:hidden" ref={moreMenuRef}>
                <button
                  onClick={() => setMoreMenuOpen(o => !o)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50"
                  style={{ color: 'var(--muted)' }}
                  aria-label="More"
                >
                  <MoreDotsIcon />
                </button>
                {moreMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1.5 z-50 rounded-xl shadow-xl overflow-hidden py-1"
                    style={{ background: 'var(--surface)', border: '1px solid var(--line)', minWidth: 180 }}
                  >
                    <button
                      onClick={() => { toggleFullscreen(); setMoreMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                      style={{ color: isFullscreen ? 'var(--red)' : 'var(--ink)', background: 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--band)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                      {isFullscreen ? t('layout.exitFullscreen', 'Exit fullscreen') : t('layout.enterFullscreen', 'Fullscreen')}
                    </button>
                    <div className="my-1" style={{ height: 1, background: 'var(--line)' }} />
                    <div className="px-4 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{t('layout.language', 'Language')}</span>
                    </div>
                    {LANGUAGES.map(lang => {
                      const active = i18n.language === lang.code || i18n.language?.startsWith(lang.code);
                      return (
                        <button
                          key={lang.code}
                          onClick={() => { i18n.changeLanguage(lang.code); setMoreMenuOpen(false); }}
                          className="w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors"
                          style={{ color: active ? 'var(--red)' : 'var(--ink)', fontWeight: active ? 600 : 400, background: active ? 'var(--red-soft)' : 'transparent' }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--band)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = active ? 'var(--red-soft)' : 'transparent'; }}
                        >
                          {lang.label}
                          <span className="text-[10px] tracking-wider" style={{ fontFamily: 'var(--mono)', color: active ? 'var(--red)' : 'var(--muted)' }}>{lang.code.toUpperCase()}</span>
                        </button>
                      );
                    })}
                    <div className="my-1" style={{ height: 1, background: 'var(--line)' }} />
                    <button
                      onClick={() => { handleLogout(); setMoreMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                      style={{ color: 'var(--ink)', background: 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--band)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <LogoutIcon />
                      {t('layout.logout', 'Log out')}
                    </button>
                  </div>
                )}
              </div>
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
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-40 md:pb-6" style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}>
          <Outlet context={{ sipConnected: isConnected, sipMuted: muted, toggleMute, isListenOnly, isMonitorMode, setGestureActive }} />
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
      {isConnected && !isListenOnly && !isMonitorMode && <MuteFAB muted={muted} onToggle={toggleMute} panelOpen={broadcastPanelOpen} gestureActive={gestureActive} />}

      {/* ── Mobile bottom stack: items stack above bottom nav naturally ── */}
      <div
        className="md:hidden fixed left-0 right-0 z-50 flex flex-col items-stretch"
        style={{ bottom: `calc(${isConnected && !isListenOnly && !isMonitorMode ? '52px + ' : ''}49px + env(safe-area-inset-bottom))` }}
      >
        {isConnected && !isListenOnly && !isMonitorMode && <MobileMuteFAB muted={muted} onToggle={toggleMute} gestureActive={gestureActive} />}
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
        {isConnected && !isListenOnly && !isMonitorMode && <MobilePTTBar muted={muted} onToggle={toggleMute} />}
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

      {extensionHelpOpen && (
        <ExtensionHelpModal onClose={() => setExtensionHelpOpen(false)} />
      )}

      {yealinkLostOpen && (
        <YealinkLostDialog
          takingOver={takingOver}
          onTakeOver={confirmWebTakeover}
          onWait={(dontAsk) => {
            if (dontAsk) try { localStorage.setItem('hq_yealink_lost_dismiss', '1'); } catch {}
            setYealinkLostOpen(false);
          }}
        />
      )}

      {yealinkBackOpen && (
        <YealinkBackDialog
          releasing={releasing}
          onRelease={confirmReleaseToPhone}
          onStay={(dontAsk) => {
            if (dontAsk) try { localStorage.setItem('hq_yealink_back_dismiss', '1'); } catch {}
            setYealinkBackOpen(false);
          }}
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

function YealinkLostDialog({ takingOver, onTakeOver, onWait }) {
  const { t } = useTranslation('dashboard');
  const [dontAsk, setDontAsk] = useState(false);

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
            <PhoneIcon size={19} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('layout.yealinkLost.title', 'Yealink desk phone disconnected')}</h2>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('layout.yealinkLost.body', 'Your desk phone dropped off the hotline. Take over the call from this browser, or wait for the desk phone to reconnect.')}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl px-4 py-3" style={{ background: 'var(--band)', border: '1px solid var(--line)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>
            {t('layout.yealinkLost.note', 'While you wait you are off the hotline and will not hear calls. Taking over connects you right away — you can release back to the desk phone when it returns.')}
          </p>
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
          <input type="checkbox" checked={dontAsk} onChange={e => setDontAsk(e.target.checked)} className="w-4 h-4 rounded accent-current" style={{ accentColor: 'var(--accent)' }} />
          <span className="text-sm" style={{ color: 'var(--muted)' }}>{t('layout.dontAskAgain', "Don't ask me again")}</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mt-4">
          <button type="button" onClick={onTakeOver} disabled={takingOver} className="hq-btn py-3">
            {takingOver ? t('layout.yealinkLost.takingOver', 'Connecting…') : t('layout.yealinkLost.takeOver', 'Take over on web')}
          </button>
          <button
            type="button"
            onClick={() => onWait(dontAsk)}
            disabled={takingOver}
            className="px-5 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)' }}
          >
            {t('layout.yealinkLost.wait', 'Wait for desk phone')}
          </button>
        </div>
      </div>
    </div>
  );
}


function YealinkBackDialog({ releasing, onRelease, onStay }) {
  const { t } = useTranslation('dashboard');
  const [dontAsk, setDontAsk] = useState(false);

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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(18,183,106,0.12)', color: 'var(--green)' }}>
            <PhoneIcon size={19} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{t('layout.yealinkBack.title', 'Your Yealink desk phone is back online')}</h2>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
              {t('layout.yealinkBack.body', 'You are on the browser right now. Release the call back to your desk phone, or keep talking from here.')}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl px-4 py-3" style={{ background: 'var(--band)', border: '1px solid var(--line)' }}>
          <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>
            {t('layout.yealinkBack.note', 'Releasing hands the call to the desk phone and turns web takeover off. Staying keeps the call in this browser — you can release later from Settings.')}
          </p>
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
          <input type="checkbox" checked={dontAsk} onChange={e => setDontAsk(e.target.checked)} className="w-4 h-4 rounded accent-current" style={{ accentColor: 'var(--accent)' }} />
          <span className="text-sm" style={{ color: 'var(--muted)' }}>{t('layout.dontAskAgain', "Don't ask me again")}</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mt-4">
          <button type="button" onClick={onRelease} disabled={releasing} className="hq-btn py-3">
            {releasing ? t('layout.yealinkBack.releasing', 'Releasing…') : t('layout.yealinkBack.release', 'Release to phone')}
          </button>
          <button
            type="button"
            onClick={() => onStay(dontAsk)}
            disabled={releasing}
            className="px-5 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--muted)' }}
          >
            {t('layout.yealinkBack.stay', 'Stay on web')}
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
  const [micStatus, setMicStatus] = useState('idle'); // idle | requesting | blocked | no-mic
  const [hasMic, setHasMic] = useState(true);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      const inputs = devices.filter(d => d.kind === 'audioinput');
      const hasReal = inputs.some(d => d.label !== '');
      const hasAny = inputs.length > 0;
      if (!hasAny) setHasMic(false);
      else if (!hasReal) {
        navigator.permissions?.query({ name: 'microphone' }).then(p => {
          if (p.state === 'granted') setHasMic(false);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

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
    } catch (err) {
      if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError' || err.name === 'NotReadableError') {
        setHasMic(false);
        return;
      }
      setMicStatus('blocked');
    }
  }

  if (!hasMic) return null;

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
  const [hasMic, setHasMic] = useState(true);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      const inputs = devices.filter(d => d.kind === 'audioinput');
      if (!inputs.length) setHasMic(false);
      else if (inputs.every(d => d.label === '')) {
        navigator.permissions?.query({ name: 'microphone' }).then(p => {
          if (p.state === 'granted') setHasMic(false);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

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
    } catch (err) {
      if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError' || err.name === 'NotReadableError') {
        setHasMic(false);
        return;
      }
      setMicStatus('blocked');
    }
  }

  if (!hasMic) return null;

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

function GestureIndicator({ muted }) {
  return (
    <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{
      background: muted ? 'var(--red)' : 'var(--green)',
      boxShadow: muted ? '0 4px 12px rgba(217,45,32,0.35)' : '0 4px 12px rgba(18,183,106,0.35)',
      transition: 'background 0.2s',
    }}>
      <style>{`@keyframes gesture-dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      <span style={{ fontSize: 18 }}>{muted ? '✊' : '✋'}</span>
    </div>
  );
}

function MuteFAB({ muted, onToggle, panelOpen, gestureActive }) {
  return (
    <div className="hidden md:flex fixed z-50 items-center gap-2 bottom-6" style={{
      right: panelOpen ? 358 : 24,
      transition: 'right 0.25s ease',
    }}>
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
      {gestureActive && <GestureIndicator muted={muted} />}
    </div>
  );
}

function MobilePTTBar({ muted, onToggle }) {
  const { t } = useTranslation('dashboard');
  const [held, setHeld] = useState(false);
  const wasMutedRef = useRef(true);
  const pressAtRef = useRef(0);
  const touchUsedRef = useRef(false);

  // Tap (<300ms) toggles mute; holding is push-to-talk. Logic lives in
  // redline_sip_client.js (pttStart/pttEnd); inline fallback for a cached
  // older sip client that doesn't expose the PTT API yet.
  // Touch devices also fire synthetic mouse events after touch — those would
  // re-toggle and undo the tap, so mouse handlers are ignored once touch is seen.
  function onStart(e) {
    e.preventDefault();
    setHeld(true);
    const hc = window.hotlineClient;
    if (hc?.pttStart) { hc.pttStart(); return; }
    pressAtRef.current = Date.now();
    wasMutedRef.current = hc?.isMuted?.() ?? true;
    if (wasMutedRef.current) onToggle();
  }
  function onEnd(e) {
    e.preventDefault();
    if (!held) return;
    setHeld(false);
    const hc = window.hotlineClient;
    if (hc?.pttEnd) { hc.pttEnd(); return; }
    if (Date.now() - pressAtRef.current < 300) {
      if (!wasMutedRef.current) onToggle();
      return;
    }
    if (wasMutedRef.current && hc && !hc.isMuted()) onToggle();
  }

  const live = held || !muted;

  return (
    <button
      onTouchStart={(e) => { touchUsedRef.current = true; onStart(e); }}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      onMouseDown={(e) => { if (!touchUsedRef.current) onStart(e); }}
      onMouseUp={(e) => { if (!touchUsedRef.current) onEnd(e); }}
      onMouseLeave={(e) => { if (!touchUsedRef.current) onEnd(e); }}
      className="w-full flex items-center justify-center gap-2 select-none"
      style={{
        height: 52,
        background: live ? 'var(--green)' : 'var(--red)',
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
      {live ? <><MicOnIcon size={18} /> {t('layout.ptt.live')}</> : <><MicOffIcon size={18} /> {t('layout.ptt.hold')}</>}
    </button>
  );
}

function MobileMuteFAB({ muted, onToggle, gestureActive }) {
  return (
    <div className="flex justify-center items-center gap-3 py-2">
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
      {gestureActive && <GestureIndicator muted={muted} />}
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
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <style>{`
        @keyframes hqm-w1{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes hqm-w2{0%,100%{opacity:.7}50%{opacity:.15}}
        @keyframes hqm-vib{0%{transform:rotate(0)}3%{transform:rotate(-2.5deg)}6%{transform:rotate(2.5deg)}9%{transform:rotate(-2deg)}12%{transform:rotate(1.5deg)}15%,100%{transform:rotate(0)}}
      `}</style>
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#d92d20" />
      <g style={{ transformOrigin: '24px 24px', animation: 'hqm-vib 2s ease-in-out infinite' }}>
        <path d="M33.8 30.7v2.6a2.3 2.3 0 0 1-2.5 2.3 23 23 0 0 1-10-3.6 22.7 22.7 0 0 1-7-7 23 23 0 0 1-3.5-10.1 2.3 2.3 0 0 1 2.3-2.5h2.6a2.3 2.3 0 0 1 2.3 2c.1 1 .4 2.1.7 3.1a2.3 2.3 0 0 1-.5 2.4l-1.1 1.1a18.4 18.4 0 0 0 6.7 6.7l1.1-1.1a2.3 2.3 0 0 1 2.4-.5c1 .3 2 .6 3.1.7a2.3 2.3 0 0 1 2 2.3z" fill="#fff" />
      </g>
      <path d="M30.5 13.6a8.6 8.6 0 0 1 5 5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" style={{ animation: 'hqm-w1 1.4s ease-in-out infinite' }} />
      <path d="M32.8 8.4a14.3 14.3 0 0 1 8 8" stroke="#ffb4ad" strokeWidth="2.6" strokeLinecap="round" style={{ animation: 'hqm-w2 1.4s ease-in-out infinite 0.2s' }} />
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

function MoreDotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
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
