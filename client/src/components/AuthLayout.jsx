import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const DARK = {
  bg: '#1a1d27',
  surface: 'rgba(255,255,255,0.05)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  text: '#fff',
  muted: 'rgba(255,255,255,0.45)',
  dim: 'rgba(255,255,255,0.25)',
  red: '#ef4444',
  redSoft: 'rgba(239,68,68,0.15)',
  green: '#22c55e',
  greenSoft: 'rgba(34,197,94,0.15)',
  copper: '#92400e',
  copperBg: 'rgba(146,64,14,0.2)',
};

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img src="/favicon.svg" alt="Hotline HQ" className="w-10 h-10" style={{ filter: 'drop-shadow(0 4px 16px rgba(239,68,68,0.4))' }} />
      <span className="text-xl font-bold tracking-tight" style={{ color: DARK.text }}>
        Hotline <span style={{ color: DARK.red }}>HQ</span>
      </span>
    </Link>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: DARK.red, fontFamily: 'var(--mono)' }}>
      {children}
    </p>
  );
}

function StatCard({ value, label, accent }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: DARK.surface, border: `1px solid ${DARK.surfaceBorder}` }}>
      <div className="text-2xl font-bold" style={{ color: accent ? DARK.red : DARK.text }}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: DARK.muted, fontFamily: 'var(--mono)' }}>{label}</div>
    </div>
  );
}

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0"><circle cx="8" cy="8" r="7" fill={DARK.red} /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function XIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0"><circle cx="8" cy="8" r="7" stroke={DARK.dim} strokeWidth="1.5" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={DARK.muted} strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

// ────────────────────────────────────────────────────────────────
// LOGIN — returning user. Show missed requests they could have caught
// ────────────────────────────────────────────────────────────────
function LoginPanel() {
  const [d, setD] = useState(null);

  useEffect(() => {
    fetch('/api/v1/public/network-stats')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.status) setD(j.data); })
      .catch(() => {});
  }, []);

  function timeAgo(ts) {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  const missed = d?.missedRequests || [];

  return (
    <>
      <Logo />

      {/* Hero tagline */}
      <div className="mt-8">
        <p className="text-sm leading-relaxed" style={{ color: DARK.muted }}>
          Your network is live. While you were away:
        </p>
      </div>

      {/* Missed requests — the emotional core */}
      {missed.length > 0 && (
        <div className="mt-5">
          <SectionLabel>Requests Nobody Answered</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {missed.slice(0, 3).map((req, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: `1px solid rgba(239,68,68,0.25)` }}>
                <div className="px-4 py-3" style={{ background: DARK.surface }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: DARK.red }}>Unanswered</span>
                    <span className="text-[10px]" style={{ color: DARK.dim }}>{timeAgo(req.ts)}</span>
                  </div>
                  <div className="text-base font-bold" style={{ color: DARK.text }}>
                    {req.parts.year} {req.parts.make} {req.parts.model}
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: DARK.red }}>
                    {req.parts.part}{req.parts.spec ? ` — ${req.parts.spec}` : ''}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: DARK.dim }}>
                    <span>{req.yard}</span>
                    <span style={{ color: DARK.surfaceBorder }}>·</span>
                    <span>{req.room}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* The line */}
          <div className="mt-4 rounded-xl p-4 text-center" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-sm font-semibold leading-relaxed" style={{ color: '#fff' }}>
              Nobody had it. <span className="underline decoration-2 underline-offset-2">You could have.</span>
            </p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Log in and start catching requests.
            </p>
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Compact stats */}
      <div className="flex flex-col gap-4 mt-6">
        <div>
          <SectionLabel>Right Now</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard value={d?.listeningNow ?? '—'} label="Listening" accent />
            <StatCard value={d?.activeRooms ?? '—'} label="Rooms" />
            <StatCard value={d?.yesterdayBroadcasts ?? '—'} label="Yesterday" />
          </div>
        </div>
      </div>

      {/* Live pulse */}
      <div className="flex items-center gap-2.5 text-sm mt-5" style={{ color: DARK.muted }}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: DARK.green }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: DARK.green }} />
        </span>
        <span>
          Parts are being requested right now — <span className="font-bold" style={{ color: DARK.text }}>log in to respond</span>
        </span>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// SIGNUP — demand proof + what you get
// ────────────────────────────────────────────────────────────────
function SignupPanel() {
  const [d, setD] = useState(null);

  useEffect(() => {
    fetch('/api/v1/public/network-stats')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.status) setD(j.data); })
      .catch(() => {});
  }, []);

  const trend = d?.dailyTrend || [];
  const weeklyTotal = trend.reduce((s, day) => s + day.total, 0);
  const weeklyAnswered = trend.reduce((s, day) => s + day.answered, 0);
  const weeklyUnanswered = weeklyTotal - weeklyAnswered;
  const missRate = weeklyTotal > 0 ? Math.round((weeklyUnanswered / weeklyTotal) * 100) : 0;
  const maxDay = trend.length > 0 ? Math.max(...trend.map(day => day.total)) : 1;
  const dayLabels = trend.map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (trend.length - 1 - i));
    return date.toLocaleDateString('en', { weekday: 'short' }).slice(0, 3);
  });

  const FEATURES = [
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, title: 'Desk Phone Included', desc: 'Preconfigured Yealink T31P ships to your door', to: '/features/desk-phone' },
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, title: 'Caller ID', desc: 'See who is requesting on every broadcast', to: '/features/caller-id' },
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, title: '99.9% Uptime', desc: 'Always-on network, no dropped connections', to: '/features/always-on-voice-network' },
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, title: 'Multi-Region', desc: 'Switch to any market with one button press', to: '/features/always-on-voice-network' },
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>, title: 'Direct Calls', desc: 'Call any yard directly, no operator needed', to: '/features/direct-calls' },
    { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={DARK.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>, title: 'Live Dashboard', desc: 'Real-time broadcasts, members and analytics', to: '/features/admin-dashboard' },
  ];

  return (
    <>
      <Logo />

      {/* Demand hero — red gradient card */}
      <div className="mt-8 rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-black tabular-nums" style={{ color: '#fff', lineHeight: 1 }}>
            {weeklyUnanswered || '—'}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>this week</span>
        </div>
        <h2 className="text-lg font-bold mt-3" style={{ color: '#fff', lineHeight: 1.3 }}>
          Parts requests that went unanswered
        </h2>
        <p className="mt-3 text-sm leading-relaxed px-3 py-2 rounded-lg" style={{ color: '#fff', background: 'rgba(255,255,255,0.12)', borderLeft: '3px solid #fff' }}>
          If you'd been on the network, you'd have heard these live and <span className="font-bold underline decoration-2 underline-offset-2">closed the deal in seconds</span>.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-6 my-6">
        {/* 7-Day Demand Chart */}
        {trend.length > 0 && (
          <div>
            <SectionLabel>7-Day Demand</SectionLabel>
            <div className="flex items-end gap-1.5" style={{ height: 100 }}>
              {trend.map((day, i) => {
                const totalH = (day.total / maxDay) * 72;
                const answeredH = day.total > 0 ? (day.answered / day.total) * totalH : 0;
                const isToday = i === trend.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[9px] font-bold tabular-nums" style={{ color: DARK.dim }}>
                      {day.total - day.answered}
                    </div>
                    <div className="relative w-full flex flex-col justify-end" style={{ height: 72 }}>
                      <div className="relative w-full rounded-sm overflow-hidden" style={{ height: Math.max(totalH, 2) }}>
                        <div className="absolute inset-0" style={{ background: 'rgba(239,68,68,0.3)' }} />
                        <div className="absolute bottom-0 left-0 right-0" style={{ height: answeredH, background: 'rgba(34,197,94,0.4)' }} />
                      </div>
                    </div>
                    <div className="text-[9px] font-medium" style={{ color: isToday ? DARK.text : DARK.dim }}>
                      {dayLabels[i]}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(34,197,94,0.4)' }} />
                <span className="text-[10px]" style={{ color: DARK.dim }}>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(239,68,68,0.3)' }} />
                <span className="text-[10px]" style={{ color: DARK.dim }}>Unanswered</span>
              </div>
            </div>
          </div>
        )}

        {/* How It Works — red strip */}
        <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>How It Works</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { n: '1', t: 'Sign up free', d: 'Create your account in 30 seconds' },
              { n: '2', t: 'Plug in phone', d: 'Yealink connects automatically' },
              { n: '3', t: 'Hear requests', d: 'Pick up when you have the part' },
            ].map(s => (
              <div key={s.n} className="flex flex-col items-center text-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>{s.n}</div>
                <div className="text-xs font-semibold" style={{ color: '#fff' }}>{s.t}</div>
                <div className="text-[10px] mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* What You Get */}
        <div>
          <SectionLabel>What You Get</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {FEATURES.map(f => (
              <Link key={f.title} to={f.to} target="_blank" rel="noopener noreferrer" className="rounded-xl p-3 no-underline transition-colors" style={{ background: DARK.surface, border: `1px solid ${DARK.surfaceBorder}`, textDecoration: 'none' }}>
                <div className="flex items-center gap-2 mb-1">
                  {f.icon}
                  <span className="text-xs font-semibold" style={{ color: DARK.text }}>{f.title}</span>
                </div>
                <div className="text-[11px] leading-relaxed" style={{ color: DARK.muted }}>{f.desc}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top markets with demand data */}
        {d?.topRooms?.length > 0 && (
          <div>
            <SectionLabel>Top Markets</SectionLabel>
            <div className="flex flex-col gap-1.5">
              {d.topRooms.filter(r => r.broadcasts > 0).map(r => (
                <div key={r.name} className="flex items-center justify-between rounded-lg px-3.5 py-2.5" style={{ background: DARK.surface, border: `1px solid ${DARK.surfaceBorder}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: DARK.text }}>{r.name}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: DARK.redSoft, color: DARK.red }}>{r.yards} yards</span>
                  </div>
                  <span className="text-xs font-medium tabular-nums" style={{ color: DARK.muted }}>
                    {r.broadcasts >= 1000 ? `${(r.broadcasts / 1000).toFixed(1)}k` : r.broadcasts} requests
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live pulse */}
      <div className="flex items-center gap-2.5 text-sm" style={{ color: DARK.muted }}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: DARK.green }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: DARK.green }} />
        </span>
        <span>
          <span className="font-bold" style={{ color: DARK.text }}>{d?.listeningNow ?? '—'}</span> yards listening right now
        </span>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// FORGOT / RESET PASSWORD — reassure the user
// ────────────────────────────────────────────────────────────────
function ForgotPanel() {
  return (
    <>
      <div>
        <Logo />
        <p className="text-sm leading-relaxed mt-3" style={{ color: DARK.muted }}>
          Don't worry — we'll get you back on the network in under a minute.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-5 my-8">
        <div>
          <SectionLabel>Quick Recovery</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {[
              { n: '1', t: 'Enter your email address', d: 'The one you used when signing up.' },
              { n: '2', t: 'Check your inbox', d: 'We\'ll send a reset link — check spam if you don\'t see it.' },
              { n: '3', t: 'Set a new password', d: 'Pick something memorable. You\'re back on the network.' },
            ].map(s => (
              <div key={s.n} className="flex items-center gap-3 rounded-xl p-3.5" style={{ background: DARK.surface, border: `1px solid ${DARK.surfaceBorder}` }}>
                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-sm font-bold" style={{ background: DARK.redSoft, color: DARK.red }}>{s.n}</div>
                <div>
                  <div className="text-sm font-medium" style={{ color: DARK.text }}>{s.t}</div>
                  <div className="text-xs" style={{ color: DARK.muted }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: DARK.surface, border: `1px solid ${DARK.surfaceBorder}` }}>
          <div className="flex items-center gap-2 mb-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DARK.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: DARK.text }}>Your desk phone stays connected</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: DARK.muted }}>
            Your physical phone uses a separate connection — it stays on the hotline even while you reset your dashboard password. You won't miss any broadcasts.
          </p>
        </div>

        <div className="rounded-xl p-4" style={{ background: DARK.surface, border: `1px solid ${DARK.surfaceBorder}` }}>
          <div className="flex items-center gap-2 mb-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DARK.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: DARK.text }}>Can't access your email?</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: DARK.muted }}>
            Contact us on WhatsApp and we'll verify your identity and get you back in.
          </p>
        </div>
      </div>

      <div className="text-xs" style={{ color: DARK.dim }}>
        Reset links expire in 1 hour for security.
      </div>
    </>
  );
}

const PANELS = {
  login: LoginPanel,
  signup: SignupPanel,
  forgot: ForgotPanel,
  reset: ForgotPanel,
};

export default function AuthLayout({ variant = 'login', children }) {
  const Panel = PANELS[variant] || PANELS.login;

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left dark panel */}
      <div
        className="hidden lg:flex flex-col flex-1 p-10 min-h-screen overflow-y-auto"
        style={{ background: DARK.bg }}
      >
        <Panel />
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center px-4 py-8 overflow-y-auto">
        <div className="flex-1" />
        {children}
        <div className="flex-1" />
      </div>
    </div>
  );
}
