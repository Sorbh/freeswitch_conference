import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2Icon, EyeIcon, EyeOffIcon } from "lucide-react";

function HQMark({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#d92d20" />
      <path
        d="M33.8 30.7v2.6a2.3 2.3 0 0 1-2.5 2.3 23 23 0 0 1-10-3.6 22.7 22.7 0 0 1-7-7 23 23 0 0 1-3.5-10.1 2.3 2.3 0 0 1 2.3-2.5h2.6a2.3 2.3 0 0 1 2.3 2c.1 1 .4 2.1.7 3.1a2.3 2.3 0 0 1-.5 2.4l-1.1 1.1a18.4 18.4 0 0 0 6.7 6.7l1.1-1.1a2.3 2.3 0 0 1 2.4-.5c1 .3 2 .6 3.1.7a2.3 2.3 0 0 1 2 2.3z"
        fill="#ffffff"
      />
      <path d="M30.5 13.6a8.6 8.6 0 0 1 5 5" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M32.8 8.4a14.3 14.3 0 0 1 8 8" stroke="#ffb4ad" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function PulseRing({ delay = 0 }) {
  return (
    <div
      className="absolute inset-0 rounded-full border border-[#d92d20]/20"
      style={{
        animation: `login-pulse 3s ease-out ${delay}s infinite`,
      }}
    />
  );
}

function SignalCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let t = 0;

    function resize() {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    }
    resize();
    window.addEventListener("resize", resize);

    const lines = Array.from({ length: 6 }, (_, i) => ({
      y: 0.15 + i * 0.14,
      speed: 0.3 + Math.random() * 0.4,
      amp: 2 + Math.random() * 4,
      freq: 0.008 + Math.random() * 0.006,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.04 + Math.random() * 0.06,
    }));

    function draw() {
      t += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const line of lines) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(217, 45, 32, ${line.alpha})`;
        ctx.lineWidth = 1;
        const baseY = line.y * canvas.height;
        for (let x = 0; x < canvas.width; x += 2) {
          const y = baseY + Math.sin(x * line.freq + t * line.speed + line.phase) * line.amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  const savedEmail = localStorage.getItem("hq-remember-email") || "";
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(!!savedEmail);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, remember);
      if (remember) {
        localStorage.setItem("hq-remember-email", email);
      } else {
        localStorage.removeItem("hq-remember-email");
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[oklch(0.08_0.015_270)] flex">
      <style>{`
        @keyframes login-pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes login-fadein {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-4px); }
          30%, 70% { transform: translateX(4px); }
        }
        @keyframes login-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(217, 45, 32, 0.15); }
          50% { box-shadow: 0 0 40px rgba(217, 45, 32, 0.25); }
        }
        @keyframes login-scan {
          0% { top: -2px; }
          100% { top: calc(100% + 2px); }
        }
        .login-input:focus-within {
          border-color: rgba(217, 45, 32, 0.5);
          box-shadow: 0 0 0 3px rgba(217, 45, 32, 0.08);
        }
      `}</style>

      <SignalCanvas />

      {/* Decorative grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(217, 45, 32, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(217, 45, 32, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Corner brackets */}
      <div className="absolute top-6 left-6 w-12 h-12 border-l-2 border-t-2 border-[#d92d20]/20 pointer-events-none" />
      <div className="absolute top-6 right-6 w-12 h-12 border-r-2 border-t-2 border-[#d92d20]/20 pointer-events-none" />
      <div className="absolute bottom-6 left-6 w-12 h-12 border-l-2 border-b-2 border-[#d92d20]/20 pointer-events-none" />
      <div className="absolute bottom-6 right-6 w-12 h-12 border-r-2 border-b-2 border-[#d92d20]/20 pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
        {/* Logo + pulse */}
        <div
          className="relative mb-10"
          style={{
            animation: mounted ? "login-fadein 0.6s ease-out forwards" : "none",
            opacity: mounted ? 1 : 0,
          }}
        >
          <div className="relative z-10" style={{ animation: "login-glow 3s ease-in-out infinite" }}>
            <HQMark size={56} />
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14">
            <PulseRing delay={0} />
            <PulseRing delay={1} />
            <PulseRing delay={2} />
          </div>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-[380px]"
          style={{
            animation: mounted ? "login-fadein 0.6s ease-out 0.15s both" : "none",
            opacity: 0,
          }}
        >
          <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
            {/* Scan line */}
            <div
              className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d92d20]/30 to-transparent pointer-events-none"
              style={{ animation: "login-scan 4s linear infinite" }}
            />

            <div className="p-8 pt-7">
              {/* Header */}
              <div className="text-center mb-7">
                <h1 className="text-lg font-semibold tracking-tight text-white/90">
                  Hotline <span className="italic text-[#d92d20]">HQ</span>
                </h1>
                <p className="text-[13px] text-white/30 mt-1 font-mono uppercase tracking-[0.15em]">
                  Admin Console
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                style={{
                  animation: shake ? "login-shake 0.4s ease-in-out" : "none",
                }}
              >
                {error && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-[#d92d20]/30 bg-[#d92d20]/[0.06] px-3.5 py-2.5 text-[13px] text-[#ff6b6b]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d92d20] shrink-0 animate-pulse" />
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/35 pl-0.5">
                    Email
                  </label>
                  <div className="login-input rounded-lg border border-white/[0.08] bg-white/[0.03] transition-all duration-200">
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent px-3.5 py-2.5 text-sm text-white/90 placeholder:text-white/20 focus:outline-none"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-[11px] font-mono uppercase tracking-[0.12em] text-white/35 pl-0.5">
                    Password
                  </label>
                  <div className="login-input rounded-lg border border-white/[0.08] bg-white/[0.03] transition-all duration-200 flex items-center">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent px-3.5 py-2.5 text-sm text-white/90 placeholder:text-white/20 focus:outline-none"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="px-3 text-white/20 hover:text-white/50 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword
                        ? <EyeOffIcon className="size-4" />
                        : <EyeIcon className="size-4" />
                      }
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer group pt-1">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-4 h-4 rounded border border-white/15 bg-white/[0.03] peer-checked:bg-[#d92d20]/20 peer-checked:border-[#d92d20]/50 transition-all flex items-center justify-center">
                      {remember && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-[#d92d20]">
                          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-[12px] text-white/30 group-hover:text-white/45 transition-colors select-none">Remember me</span>
                </label>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative w-full h-10 rounded-lg bg-[#d92d20] text-white text-sm font-medium
                               hover:bg-[#b91c1c] active:scale-[0.98]
                               disabled:opacity-50 disabled:pointer-events-none
                               transition-all duration-150 overflow-hidden group"
                  >
                    <span className={`inline-flex items-center gap-2 transition-all duration-200 ${loading ? "opacity-0" : "opacity-100"}`}>
                      Sign in
                    </span>
                    {loading && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Loader2Icon className="size-4 animate-spin" />
                      </span>
                    )}
                    {/* Hover shine */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
                  </button>
                </div>
              </form>
            </div>

            {/* Bottom bar */}
            <div className="px-8 py-3 border-t border-white/[0.04] bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-mono text-white/25 uppercase tracking-wider">System Online</span>
                </div>
                <span className="text-[11px] font-mono text-white/15">v1.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p
          className="mt-8 text-[11px] text-white/15 font-mono tracking-wide"
          style={{
            animation: mounted ? "login-fadein 0.6s ease-out 0.3s both" : "none",
            opacity: 0,
          }}
        >
          SECURED ACCESS &middot; HOTLINE HQ
        </p>
      </div>
    </div>
  );
}
