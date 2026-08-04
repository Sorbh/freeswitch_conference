import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const DARK = {
  bg: '#0f1117',
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
// LOGIN — returning user. Show live network stats + recent broadcasts
// ────────────────────────────────────────────────────────────────
function LoginPanel() {
  const [d, setD] = useState(null);

  useEffect(() => {
    fetch('/api/v1/public/network-stats')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.status) setD(j.data); })
      .catch(() => {});
  }, []);

  return (
    <>
      <div>
        <Logo />
        <p className="text-sm leading-relaxed mt-3" style={{ color: DARK.muted }}>
          Your network is live. Parts are being requested right now.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        {[
          { label: 'HD Audio', to: '/features/desk-phone' },
          { label: 'Caller ID', to: '/features/caller-id' },
          { label: 'Private Calls', to: '/features/direct-calls' },
          { label: '99.99% Uptime', to: '/features/always-on-voice-network' },
          { label: '30s Setup', to: '/features/desk-phone' },
          { label: 'Cross-Region', to: '/features/always-on-voice-network' },
        ].map(f => (
          <Link key={f.label} to={f.to} target="_blank" rel="noopener noreferrer" className="auth-chip rounded-lg px-4 py-2.5 text-sm font-bold tracking-wide no-underline" style={{ background: 'rgba(239,68,68,0.25)', color: '#fff', border: '1px solid rgba(239,68,68,0.4)', textDecoration: 'none', transition: 'background 0.2s, border-color 0.2s' }}>{f.label}</Link>
        ))}
        <style>{`.auth-chip:hover { background: #dc2626 !important; border-color: #dc2626 !important; }`}</style>
      </div>

      <div className="flex flex-col gap-4 mt-4">
        {/* Live now */}
        <div>
          <SectionLabel>Live Right Now</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard value={d?.listeningNow ?? '—'} label="Yards Listening" accent />
            <StatCard value={d?.activeRooms ?? '—'} label="Rooms Active" />
          </div>
        </div>

        {/* Yesterday's activity */}
        {d?.yesterdayBroadcasts > 0 && (
          <div>
            <SectionLabel>Yesterday</SectionLabel>
            <div className="grid grid-cols-3 gap-2.5">
              <StatCard value={d.yesterdayBroadcasts} label="Broadcasts" accent />
              <StatCard value={d.yesterdayAnswered} label="Answered" />
              <StatCard value={d.yesterdayAnswerRate != null ? `${d.yesterdayAnswerRate}%` : '—'} label="Answer Rate" />
            </div>
          </div>
        )}

        {/* BROADCAST HIGHLIGHT — red card to break the pattern */}
        <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.8)' }}>Broadcast Activity</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-2xl font-bold text-white">{d?.allTimeBroadcasts ? `${(d.allTimeBroadcasts / 1000).toFixed(1)}k` : '—'}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--mono)' }}>All Time</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{d?.allTimeAnswerRate != null ? `${d.allTimeAnswerRate}%` : '—'}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--mono)' }}>Answered</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">12–2 PM</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--mono)' }}>Peak Hour</div>
            </div>
          </div>
          {d?.yesterdayBroadcasts > 0 && (
            <div className="mt-3 pt-3 flex items-center gap-2 text-[11px]" style={{ borderTop: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
              <span className="font-semibold text-white">{d.yesterdayBroadcasts}</span> broadcasts yesterday
              {d.yesterdayAnswerRate != null && <><span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span> <span className="font-semibold text-white">{d.yesterdayAnswerRate}%</span> answered</>}
            </div>
          )}
        </div>

        {/* Network overview */}
        <div>
          <SectionLabel>Network</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard value={d?.totalMembers ?? '—'} label="Total Members" />
            <StatCard value={d?.totalRooms ?? '—'} label="Markets" />
            <StatCard value={d?.avgResponseSec != null ? `${d.avgResponseSec}s` : '—'} label="Avg Response" />
            <StatCard value={d?.weeklyAnswerRate != null ? `${d.weeklyAnswerRate}%` : '—'} label="Weekly Answer %" />
          </div>
        </div>

        {/* Recent broadcasts */}
        {d?.recentBroadcasts?.length > 0 && (
          <div>
            <SectionLabel>Recent Broadcasts</SectionLabel>
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DARK.surfaceBorder}` }}>
              {d.recentBroadcasts.slice(0, 3).map((b, i) => (
                <div key={i} className="px-3.5 py-2.5 flex items-start gap-2" style={{ background: DARK.surface, borderBottom: i < 2 ? `1px solid ${DARK.surfaceBorder}` : 'none' }}>
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: b.answered ? DARK.green : DARK.red }} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold" style={{ color: DARK.red }}>
                      {b.display_name} <span style={{ color: DARK.dim }}>· {b.room_name}</span>
                    </div>
                    <div className="text-[11px] mt-0.5 italic truncate" style={{ color: DARK.muted }}>
                      "{b.transcription}"
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs mt-4" style={{ color: DARK.muted }}>
        <span className="w-2 h-2 rounded-full" style={{ background: DARK.green }} />
        <span>Parts are being requested right now — log in to respond</span>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// SIGNUP — new user. Educate: this is a phone, not an app.
// ────────────────────────────────────────────────────────────────
function SignupPanel() {
  const [d, setD] = useState(null);

  useEffect(() => {
    fetch('/api/v1/public/network-stats')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.status) setD(j.data); })
      .catch(() => {});
  }, []);

  return (
    <>
      <div>
        <Logo />
        <h2 className="text-lg font-bold mt-5 mb-1.5" style={{ color: DARK.text, lineHeight: 1.25 }}>
          <Link to="/features/desk-phone" style={{ color: DARK.text, textDecoration: 'none' }}>
            This is a phone system. <span style={{ color: DARK.red }}>Not an app.</span>
          </Link>
          {' '}<Link to="/features/desk-phone" className="text-xs font-medium" style={{ color: DARK.red, textDecoration: 'underline', textUnderlineOffset: '2px' }}>Know more?</Link>
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: DARK.text }}>
          A preconfigured Yealink desk phone sits on your counter, always on, always connected to your region's hotline. <span className="text-sm font-bold" style={{ color: DARK.red }}>Request your physical phone after signup.</span>
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-5 my-6">
        {/* How it works */}
        <div>
          <SectionLabel>How It Works</SectionLabel>
          <div className="flex flex-col gap-2">
            {[
              { n: '1', t: 'Sign up & request your phone', d: 'We ship a preconfigured Yealink T31P — or use your own from Amazon.' },
              { n: '2', t: 'Plug in one ethernet cable', d: 'Phone boots, finds the hotline, connects. No passwords, no SIP config.' },
              { n: '3', t: 'Hear parts requests all day', d: 'When you have the part, pick up the handset and respond. That\'s it.' },
            ].map(s => (
              <div key={s.n} className="rounded-xl p-3.5 flex gap-3" style={{ background: DARK.surface, border: `1px solid ${DARK.surfaceBorder}` }}>
                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: DARK.redSoft, color: DARK.red }}>{s.n}</div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: DARK.text }}>{s.t}</div>
                  <div className="text-xs mt-0.5" style={{ color: DARK.muted }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Copper vs HQ comparison */}
        <div>
          <SectionLabel>Why Yards Are Switching</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${DARK.surfaceBorder}` }}>
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ background: DARK.copperBg, color: '#fbbf24', borderBottom: `1px solid ${DARK.surfaceBorder}` }}>Old Copper Line</div>
              {['No caller ID', 'No recordings', 'One local area only', 'No transcriptions', 'Rising costs yearly', 'Fewer repair crews'].map((item, i) => (
                <div key={i} className="px-3 py-2 flex items-center gap-2 text-xs" style={{ background: DARK.surface, borderBottom: `1px solid ${DARK.surfaceBorder}`, color: DARK.muted }}>
                  <XIcon /> <span className="line-through opacity-70">{item}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid rgba(239,68,68,0.3)` }}>
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ background: DARK.redSoft, color: DARK.red, borderBottom: `1px solid rgba(239,68,68,0.2)` }}>Hotline HQ</div>
              {[
                { label: 'Caller ID on every call', to: '/features/caller-id' },
                { label: 'Auto-recorded & transcribed', to: '/features/broadcast-recording' },
                { label: 'Switch any region', to: '/features/always-on-voice-network' },
                { label: 'Searchable broadcast history', to: '/features/admin-dashboard' },
                { label: 'Flat rate — phone included', to: '/features/desk-phone' },
                { label: 'Direct yard-to-yard calls', to: '/features/direct-calls' },
              ].map((item, i) => (
                <Link key={i} to={item.to} target="_blank" rel="noopener noreferrer" className="px-3 py-2 flex items-center gap-2 text-xs no-underline" style={{ background: DARK.surface, borderBottom: `1px solid ${DARK.surfaceBorder}`, color: DARK.text, fontWeight: 500, textDecoration: 'none' }}>
                  <CheckIcon /> <span className="hover:underline">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Social proof stats */}
        <div>
          <SectionLabel>The Network Today</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard value={d?.totalMembers ?? '500+'} label="Yards" accent />
            <StatCard value={d?.totalRooms ?? '15+'} label="Markets" />
            <StatCard value={d?.allTimeBroadcasts ? `${Math.round(d.allTimeBroadcasts / 1000)}k+` : '—'} label="Broadcasts" />
          </div>
        </div>

        {/* Top rooms */}
        {d?.topRooms?.length > 0 && (
          <div>
            <SectionLabel>Active Markets</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {d.topRooms.map(r => (
                <span key={r.name} className="rounded-md px-2.5 py-1.5 text-[11px] font-medium" style={{ background: DARK.surface, border: `1px solid ${DARK.surfaceBorder}`, color: DARK.text }}>
                  {r.name} <span style={{ color: DARK.dim }}>({r.yards})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Phone included */}
      <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: DARK.redSoft, border: '1px solid rgba(239,68,68,0.2)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={DARK.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <div>
          <div className="text-sm font-semibold" style={{ color: DARK.red }}>Physical phone included</div>
          <div className="text-xs" style={{ color: DARK.muted }}>Request your preconfigured Yealink desk phone after signup.</div>
        </div>
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
        className="hidden lg:flex flex-col flex-1 p-10 min-h-screen"
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
