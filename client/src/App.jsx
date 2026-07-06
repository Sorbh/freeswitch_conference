import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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
const NotFoundPage = lazy(() => import('./pages/landing2/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const AboutPage = lazy(() => import('./pages/landing2/LegalPages').then(m => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() => import('./pages/landing2/LegalPages').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/landing2/LegalPages').then(m => ({ default: m.TermsPage })));
const DisclaimerPage = lazy(() => import('./pages/landing2/LegalPages').then(m => ({ default: m.DisclaimerPage })));

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

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public / marketing pages */}
        <Route path="/" element={<Lazy><Landing2Page /></Lazy>} />
        <Route path="/classic" element={<Lazy><LandingPage /></Lazy>} />
        <Route path="/b/:token" element={<Lazy><PublicBroadcastPage /></Lazy>} />
        <Route path="/own-a-hotline" element={<Lazy><OwnHotlinePage /></Lazy>} />
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
