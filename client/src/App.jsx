import { lazy, Suspense, useEffect, Component } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    if (error?.name === 'ChunkLoadError' || error?.message?.includes('Loading chunk') || error?.message?.includes('dynamically imported module')) {
      const reloaded = sessionStorage.getItem('hq_chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('hq_chunk_reload', '1');
        window.location.reload();
        return { hasError: false };
      }
    }
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', gap: '16px', padding: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', color: '#5d6370' }}>A new version is available.</p>
          <button onClick={() => { sessionStorage.removeItem('hq_chunk_reload'); window.location.reload(); }} style={{ padding: '12px 24px', fontSize: '15px', fontWeight: 600, color: '#fff', background: '#d92d20', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const DashboardLayout = lazy(() => import('./components/DashboardLayout'));
const ConferencePage = lazy(() => import('./pages/ConferencePage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'));
const RequestRoomPage = lazy(() => import('./pages/RequestRoomPage'));
const Landing2Page = lazy(() => import('./pages/Landing2Page'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PublicBroadcastPage = lazy(() => import('./pages/PublicBroadcastPage'));
const OwnHotlinePage = lazy(() => import('./pages/landing2/OwnHotlinePage').then(m => ({ default: m.OwnHotlinePage })));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const PartsListingPage = lazy(() => import('./pages/PartsListingPage'));
const FindPartsPage = lazy(() => import('./pages/landing2/FeaturePages').then(m => ({ default: m.FindPartsPage })));
const SellPartsPage = lazy(() => import('./pages/landing2/FeaturePages').then(m => ({ default: m.SellPartsPage })));
const HowItWorksPage = lazy(() => import('./pages/landing2/FeaturePages').then(m => ({ default: m.HowItWorksPage })));
const BlogIndexPage = lazy(() => import('./pages/landing2/BlogPages').then(m => ({ default: m.BlogIndexPage })));
const BlogCategoryPage = lazy(() => import('./pages/landing2/BlogPages').then(m => ({ default: m.BlogCategoryPage })));
const BlogPostPage = lazy(() => import('./pages/landing2/BlogPostPage').then(m => ({ default: m.BlogPostPage })));
const RegionalPartsPage = lazy(() => import('./pages/landing2/FeaturePages').then(m => ({ default: m.RegionalPartsPage })));
const NotFoundPage = lazy(() => import('./pages/landing2/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const AboutPage = lazy(() => import('./pages/landing2/LegalPages').then(m => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() => import('./pages/landing2/LegalPages').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/landing2/LegalPages').then(m => ({ default: m.TermsPage })));
const DisclaimerPage = lazy(() => import('./pages/landing2/LegalPages').then(m => ({ default: m.DisclaimerPage })));
const FeatureDetailPage = lazy(() => import('./pages/landing2/FeatureDetailPage').then(m => ({ default: m.FeatureDetailPage })));

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/client/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/client/dashboard" replace />;
  return children;
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 24 }}>
      <style>{`
        @keyframes hq-wave1{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes hq-wave2{0%,100%{opacity:.7}50%{opacity:.15}}
        @keyframes hq-glow{0%,100%{opacity:.15}50%{opacity:.35}}
        @keyframes hq-vib{0%{transform:rotate(0)}3%{transform:rotate(-2.5deg)}6%{transform:rotate(2.5deg)}9%{transform:rotate(-2deg)}12%{transform:rotate(1.5deg)}15%,100%{transform:rotate(0)}}
        @keyframes hq-fade{0%{opacity:.45}100%{opacity:1}}
      `}</style>
      <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" fill="#d92d20" style={{ animation: 'hq-glow 2s ease-in-out infinite' }} />
        <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#d92d20" />
        <g style={{ transformOrigin: '24px 24px', animation: 'hq-vib 2s ease-in-out infinite' }}>
          <path d="M33.8 30.7v2.6a2.3 2.3 0 0 1-2.5 2.3 23 23 0 0 1-10-3.6 22.7 22.7 0 0 1-7-7 23 23 0 0 1-3.5-10.1 2.3 2.3 0 0 1 2.3-2.5h2.6a2.3 2.3 0 0 1 2.3 2c.1 1 .4 2.1.7 3.1a2.3 2.3 0 0 1-.5 2.4l-1.1 1.1a18.4 18.4 0 0 0 6.7 6.7l1.1-1.1a2.3 2.3 0 0 1 2.4-.5c1 .3 2 .6 3.1.7a2.3 2.3 0 0 1 2 2.3z" fill="#fff" />
        </g>
        <path d="M30.5 13.6a8.6 8.6 0 0 1 5 5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" style={{ animation: 'hq-wave1 1.4s ease-in-out infinite' }} />
        <path d="M32.8 8.4a14.3 14.3 0 0 1 8 8" stroke="#ffb4ad" strokeWidth="2.6" strokeLinecap="round" style={{ animation: 'hq-wave2 1.4s ease-in-out infinite 0.2s' }} />
      </svg>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink, #16181d)' }}>Hotline <span style={{ color: '#d92d20' }}>HQ</span></div>
      <div style={{ marginTop: -14, fontSize: 12.5, letterSpacing: '0.04em', color: 'var(--muted, #6b7280)', animation: 'hq-fade 1.8s ease-in-out infinite alternate' }}>Connecting to the network</div>
    </div>
  );
}

function Lazy({ children }) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function ClearChunkReloadFlag() {
  useEffect(() => { sessionStorage.removeItem('hq_chunk_reload'); }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <ClearChunkReloadFlag />
      <Routes>
        {/* Public / marketing pages */}
        <Route path="/" element={<Lazy><Landing2Page /></Lazy>} />
        <Route path="/classic" element={<Lazy><LandingPage /></Lazy>} />
        <Route path="/b/:token" element={<Lazy><PublicBroadcastPage /></Lazy>} />
        <Route path="/marketplace" element={<Lazy><MarketplacePage /></Lazy>} />
        <Route path="/parts/:slug" element={<Lazy><PartsListingPage /></Lazy>} />
        <Route path="/own-a-hotline" element={<Lazy><OwnHotlinePage /></Lazy>} />
        <Route path="/features/:slug" element={<Lazy><FeatureDetailPage /></Lazy>} />
        <Route path="/find-used-auto-parts" element={<Lazy><FindPartsPage /></Lazy>} />
        <Route path="/sell-used-auto-parts" element={<Lazy><SellPartsPage /></Lazy>} />
        <Route path="/how-auto-parts-hotlines-work" element={<Lazy><HowItWorksPage /></Lazy>} />
        <Route path="/blog" element={<Lazy><BlogIndexPage /></Lazy>} />
        <Route path="/blog/guides" element={<Lazy><BlogCategoryPage category="guides" /></Lazy>} />
        <Route path="/blog/news" element={<Lazy><BlogCategoryPage category="news" /></Lazy>} />
        <Route path="/blog/market" element={<Lazy><BlogCategoryPage category="market" /></Lazy>} />
        <Route path="/blog/:category/:slug" element={<Lazy><BlogPostPage /></Lazy>} />
        <Route path="/used-auto-parts/california" element={<Lazy><RegionalPartsPage state="california" /></Lazy>} />
        <Route path="/used-auto-parts/texas" element={<Lazy><RegionalPartsPage state="texas" /></Lazy>} />
        <Route path="/used-auto-parts/florida" element={<Lazy><RegionalPartsPage state="florida" /></Lazy>} />
        <Route path="/used-auto-parts/arizona" element={<Lazy><RegionalPartsPage state="arizona" /></Lazy>} />
        <Route path="/used-auto-parts/ohio" element={<Lazy><RegionalPartsPage state="ohio" /></Lazy>} />
        <Route path="/used-auto-parts/new-york" element={<Lazy><RegionalPartsPage state="new-york" /></Lazy>} />
        <Route path="/used-auto-parts/georgia" element={<Lazy><RegionalPartsPage state="georgia" /></Lazy>} />
        <Route path="/used-auto-parts/indiana" element={<Lazy><RegionalPartsPage state="indiana" /></Lazy>} />
        <Route path="/used-auto-parts/michigan" element={<Lazy><RegionalPartsPage state="michigan" /></Lazy>} />
        <Route path="/used-auto-parts/carolinas" element={<Lazy><RegionalPartsPage state="carolinas" /></Lazy>} />
        <Route path="/used-auto-parts/mexico" element={<Lazy><RegionalPartsPage state="mexico" /></Lazy>} />
        <Route path="/used-auto-parts/new-jersey" element={<Lazy><RegionalPartsPage state="new-jersey" /></Lazy>} />
        <Route path="/used-auto-parts/san-diego" element={<Lazy><RegionalPartsPage state="san-diego" /></Lazy>} />
        <Route path="/used-auto-parts/iowa" element={<Lazy><RegionalPartsPage state="iowa" /></Lazy>} />
        <Route path="/used-auto-parts/kentucky" element={<Lazy><RegionalPartsPage state="kentucky" /></Lazy>} />
        <Route path="/used-auto-parts/alberta" element={<Lazy><RegionalPartsPage state="alberta" /></Lazy>} />
        <Route path="/used-auto-parts/canada" element={<Lazy><RegionalPartsPage state="canada" /></Lazy>} />
        <Route path="/used-auto-parts/egypt" element={<Lazy><RegionalPartsPage state="egypt" /></Lazy>} />
        <Route path="/used-auto-parts/spain" element={<Lazy><RegionalPartsPage state="spain" /></Lazy>} />
        <Route path="/used-auto-parts/ghana" element={<Lazy><RegionalPartsPage state="ghana" /></Lazy>} />
        <Route path="/about" element={<Lazy><AboutPage /></Lazy>} />
        <Route path="/privacy-policy" element={<Lazy><PrivacyPage /></Lazy>} />
        <Route path="/terms-and-conditions" element={<Lazy><TermsPage /></Lazy>} />
        <Route path="/disclaimer" element={<Lazy><DisclaimerPage /></Lazy>} />
        <Route path="/landing_2" element={<Navigate to="/" replace />} />

        {/* Client auth pages */}
        <Route path="/client/login" element={<PublicRoute><Lazy><LoginPage /></Lazy></PublicRoute>} />
        <Route path="/client/signup" element={<PublicRoute><Lazy><SignupPage /></Lazy></PublicRoute>} />
        <Route path="/client/forgot-password" element={<PublicRoute><Lazy><ForgotPasswordPage /></Lazy></PublicRoute>} />
        <Route path="/client/reset-password" element={<PublicRoute><Lazy><ResetPasswordPage /></Lazy></PublicRoute>} />

        {/* Client dashboard (authenticated) */}
        <Route path="/client/dashboard" element={<ProtectedRoute><Lazy><DashboardLayout /></Lazy></ProtectedRoute>}>
          <Route index element={<Lazy><ConferencePage /></Lazy>} />
          <Route path="members" element={<Lazy><MembersPage /></Lazy>} />
          <Route path="extensions" element={<Navigate to="/client/dashboard/members" replace />} />
          <Route path="settings" element={<Lazy><AccountSettingsPage /></Lazy>} />
          <Route path="request-room" element={<Lazy><RequestRoomPage /></Lazy>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
