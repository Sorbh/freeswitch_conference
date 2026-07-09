import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';

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

function Lazy({ children }) {
  return <Suspense fallback={<div />}>{children}</Suspense>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
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
        <Route path="/blog/guides/how-auto-parts-hotlines-work" element={<Lazy><HowItWorksPage /></Lazy>} />
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
