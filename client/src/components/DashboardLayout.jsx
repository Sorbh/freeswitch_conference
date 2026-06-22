import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const BOTTOM_NAV_ITEMS = [
  { to: '/client/dashboard', label: 'Conference', icon: PhoneIcon, end: true },
  { to: '/client/dashboard/extensions', label: 'Extensions', icon: GridIcon },
  { to: '/client/dashboard/settings', label: 'Account', icon: UserIcon },
];

const SIDEBAR_NAV_ITEMS = [
  ...BOTTOM_NAV_ITEMS,
  { to: '/client/dashboard/request-room', label: 'Request Room', icon: PlusIcon },
];

const CONN_COLORS = {
  idle:       { shadow: 'none', bar: 'transparent' },
  connecting: { shadow: '0 4px 20px rgba(245,158,11,0.35)', bar: '#f59e0b' },
  connected:  { shadow: '0 4px 20px rgba(18,183,106,0.3)', bar: 'var(--green)' },
  error:      { shadow: '0 4px 20px rgba(239,68,68,0.35)', bar: '#ef4444' },
};

export default function DashboardLayout() {
  const { account, token, logout, apiFetch, refreshAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [connState, setConnState] = useState('idle');
  const [connError, setConnError] = useState('');
  const [rooms, setRooms] = useState([]);
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const [changingRoom, setChangingRoom] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch room details + refresh account on mount
  useEffect(() => {
    if (!token) return;
    apiFetch('/rooms/details')
      .then(json => setRooms(json.data || []))
      .catch(() => {});
    refreshAccount();
  }, [token, apiFetch, refreshAccount]);

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
    window._hotlineCallStateListeners = window._hotlineCallStateListeners || [];
    window.onHotlineCallState = function (state) {
      if (state === 'connected') { setConnState('connected'); setConnError(''); }
      else { setConnState(prev => prev === 'connected' ? 'idle' : prev); }
      (window._hotlineCallStateListeners || []).forEach(fn => fn(state));
    };
    window.onHotlineLoginFailed = function (msg) {
      setConnState('error');
      setConnError(msg || 'Login failed');
    };
    const checkInterval = setInterval(() => {
      if (window.hotlineClient) {
        if (window.hotlineClient.isConnected()) setConnState('connected');
        else if (connState === 'idle' && document.getElementById('sip-client-script')) setConnState('connecting');
      }
    }, 2000);
    return () => clearInterval(checkInterval);
  }, [connState]);

  function handleLogout() {
    logout();
    navigate('/client/login');
  }

  async function handleRoomChange(newRoomId) {
    if (changingRoom) return;
    setRoomDropdownOpen(false);
    setChangingRoom(true);
    try {
      await apiFetch('/room/change', {
        method: 'PUT',
        body: JSON.stringify({ room: newRoomId }),
      });
      await refreshAccount();
      window.location.reload();
    } catch (err) {
      console.error('[ROOM] Change failed:', err.message);
      setChangingRoom(false);
    }
  }

  const currentRoomId = account?.current_room || account?.room;
  const currentRoom = rooms.find(r => r.id === currentRoomId);
  const roomLabel = currentRoom ? currentRoom.name : (currentRoomId ? `Room ${currentRoomId}` : '');
  const isConferencePage = location.pathname === '/client/dashboard' || location.pathname === '/client/dashboard/';
  const isConnected = connState === 'connected';
  const colors = CONN_COLORS[connState] || CONN_COLORS.idle;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:flex-shrink-0" style={{ background: 'var(--ink)', color: '#fff' }}>
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--red)' }}>
            <HQMarkSVG />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: 'var(--display)' }}>Hotline HQ</div>
            <div className="text-[10px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.4)' }}>Client</div>
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
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{account?.company_name}</div>
          <div className="text-[11px] truncate" style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.3)' }}>{account?.email}</div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header
          className="relative"
          style={{ background: 'var(--surface)', boxShadow: colors.shadow, transition: 'box-shadow 0.4s ease' }}
        >
          {/* Colored bar under header */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: colors.bar, transition: 'background 0.4s ease' }} />

          <div className="flex items-center justify-between px-4 md:px-6 py-3">
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
                    <button
                      onClick={() => setRoomDropdownOpen(o => !o)}
                      disabled={changingRoom}
                      className="flex items-center gap-1 text-[10px] font-semibold tracking-widest uppercase mt-0.5 hover:opacity-80 transition-opacity"
                      style={{ fontFamily: 'var(--mono)', color: 'var(--red)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      {changingRoom ? 'Switching...' : roomLabel}
                      <ChevronDownIcon />
                    </button>
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
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--red)' }}>Current</span>
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

            <button
              onClick={handleLogout}
              title="Logout"
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-red-50"
              style={{ color: 'var(--muted)' }}
            >
              <LogoutIcon />
            </button>
          </div>

          {/* Error banner */}
          {connState === 'error' && connError && (
            <div className="px-4 md:px-6 py-2 text-xs font-medium" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
              {connError}
            </div>
          )}
        </header>

        {/* Page content — extra bottom padding on mobile for bottom nav + FAB */}
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile mute FAB (only during active call) ── */}
      {isConferencePage && isConnected && <MuteFAB />}

      {/* ── Mobile bottom navigation (hidden on desktop) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t"
        style={{ background: 'var(--surface)', borderColor: 'var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
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
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function MuteFAB() {
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (window.hotlineClient) setMuted(window.hotlineClient.isMuted());
  }, []);

  function toggle() {
    if (window.hotlineClient) {
      window.hotlineClient.toggleMute();
      setMuted(m => !m);
    }
  }

  return (
    <button
      onClick={toggle}
      className="md:hidden fixed z-50 w-14 h-14 rounded-full flex items-center justify-center"
      style={{
        bottom: 'calc(60px + env(safe-area-inset-bottom) + 12px)',
        left: '50%',
        transform: 'translateX(-50%)',
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

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
