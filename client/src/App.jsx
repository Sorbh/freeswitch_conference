import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardLayout from './components/DashboardLayout';
import ConferencePage from './pages/ConferencePage';
import ExtensionsPage from './pages/ExtensionsPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import RequestRoomPage from './pages/RequestRoomPage';

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
        <Route path="/client/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/client/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/client/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/client/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

        {/* Client dashboard (authenticated) */}
        <Route path="/client/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<ConferencePage />} />
          <Route path="extensions" element={<ExtensionsPage />} />
          <Route path="settings" element={<AccountSettingsPage />} />
          <Route path="request-room" element={<RequestRoomPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
