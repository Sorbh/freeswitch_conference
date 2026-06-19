import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Outlet, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeProvider } from "@/components/theme-provider";
import { RoomsProvider } from "@/hooks/useRooms";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { lazy, Suspense } from "react";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
const Landing2Page = lazy(() => import("@/pages/Landing2Page"));
const OwnHotlinePage = lazy(() =>
  import("@/pages/landing2/OwnHotlinePage").then((m) => ({ default: m.OwnHotlinePage }))
);
const AboutPage = lazy(() =>
  import("@/pages/landing2/LegalPages").then((m) => ({ default: m.AboutPage }))
);
const PrivacyPage = lazy(() =>
  import("@/pages/landing2/LegalPages").then((m) => ({ default: m.PrivacyPage }))
);
const TermsPage = lazy(() =>
  import("@/pages/landing2/LegalPages").then((m) => ({ default: m.TermsPage }))
);
const DisclaimerPage = lazy(() =>
  import("@/pages/landing2/LegalPages").then((m) => ({ default: m.DisclaimerPage }))
);
const PublicBroadcastPage = lazy(() => import("@/pages/PublicBroadcastPage"));

const sitePages = [
  { path: "/own-a-hotline", element: <OwnHotlinePage /> },
  { path: "/about", element: <AboutPage /> },
  { path: "/privacy-policy", element: <PrivacyPage /> },
  { path: "/terms-and-conditions", element: <TermsPage /> },
  { path: "/disclaimer", element: <DisclaimerPage /> },
];
import DashboardPage from "@/pages/DashboardPage";
import UsersPage from "@/pages/UsersPage";
import RoomsPage from "@/pages/RoomsPage";
import BroadcastsPage from "@/pages/BroadcastsPage";
import DirectCallsPage from "@/pages/DirectCallsPage";
import EventsPage from "@/pages/EventsPage";
import SystemPage from "@/pages/SystemPage";
import FsLogsPage from "@/pages/FsLogsPage";
import PhoneLogsPage from "@/pages/PhoneLogsPage";
import YmcsControlPage from "@/pages/YmcsControlPage";
import NotificationsPage from "@/pages/NotificationsPage";
import AnnouncementsPage from "@/pages/AnnouncementsPage";
import ServerLogsPage from "@/pages/ServerLogsPage";
import { Loader2Icon } from "lucide-react";

const dashboardRoutes = [
  { path: "/dashboard", element: <DashboardPage />, title: "Dashboard" },
  { path: "/users", element: <UsersPage />, title: "Connected Yards" },
  { path: "/rooms", element: <RoomsPage />, title: "Rooms" },
  { path: "/broadcasts", element: <BroadcastsPage />, title: "Broadcast History" },
  { path: "/direct-calls", element: <DirectCallsPage />, title: "Extension Calls" },
  { path: "/events", element: <EventsPage />, title: "Live Events" },
  { path: "/system", element: <SystemPage />, title: "System Health" },
  { path: "/server-logs", element: <ServerLogsPage />, title: "Server Logs" },
  { path: "/fs-logs", element: <FsLogsPage />, title: "FS Logs" },
  { path: "/phone-logs", element: <PhoneLogsPage />, title: "Phone Log" },
  { path: "/ymcs", element: <YmcsControlPage />, title: "YMCS Control" },
  { path: "/notifications", element: <NotificationsPage />, title: "Notifications" },
  { path: "/announcements", element: <AnnouncementsPage />, title: "Network Announcements" },
];

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function BreadcrumbNav() {
  const location = useLocation();
  const currentRoute = dashboardRoutes.find(
    (r) => r.path === location.pathname || (r.path !== "/" && location.pathname.startsWith(r.path))
  ) || dashboardRoutes[0];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="text-muted-foreground">HotlineHQ</BreadcrumbPage>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentRoute.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return (
    <RoomsProvider>
      <AppLayout />
    </RoomsProvider>
  );
}

function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <BreadcrumbNav />
          </header>
          <div className="flex-1 overflow-auto p-6 min-w-0">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="bjs-ui-theme">
      <BrowserRouter basename={window.location.pathname.startsWith('/hotlinehq') ? '/hotlinehq' : ''}>
        <ScrollToTop />
        <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route
                path="/"
                element={
                  <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fbfaf8" }} />}>
                    <Landing2Page />
                  </Suspense>
                }
              />
              <Route path="/classic" element={<LandingPage />} />
              <Route
                path="/b/:token"
                element={
                  <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fbfaf8" }} />}>
                    <PublicBroadcastPage />
                  </Suspense>
                }
              />
              <Route path="/landing_2" element={<Navigate to="/" replace />} />
              {sitePages.map((p) => (
                <Route
                  key={p.path}
                  path={p.path}
                  element={
                    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fbfaf8" }} />}>
                      {p.element}
                    </Suspense>
                  }
                />
              ))}

              {/* Login */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected dashboard routes */}
              <Route element={<ProtectedRoute />}>
                {dashboardRoutes.map((r) => (
                  <Route key={r.path} path={r.path} element={r.element} />
                ))}
              </Route>

              {/* Redirect fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
