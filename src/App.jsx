import { BrowserRouter, Routes, Route, useLocation, Outlet, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeProvider } from "@/components/theme-provider";
import { RoomsProvider } from "@/hooks/useRooms";
import { Toaster } from "@/components/ui/sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import LandingPage from "@/pages/LandingPage";
import DashboardPage from "@/pages/DashboardPage";
import UsersPage from "@/pages/UsersPage";
import RoomsPage from "@/pages/RoomsPage";
import BroadcastsPage from "@/pages/BroadcastsPage";

const dashboardRoutes = [
  { path: "/dashboard", element: <DashboardPage />, title: "Dashboard" },
  { path: "/users", element: <UsersPage />, title: "Connected Yards" },
  { path: "/rooms", element: <RoomsPage />, title: "Voice Channels" },
  { path: "/broadcasts", element: <BroadcastsPage />, title: "Broadcast History" },
];

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

function AppLayout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <BreadcrumbNav />
          </header>
          <div className="flex-1 overflow-auto p-6">
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
      <BrowserRouter>
        <RoomsProvider>
          <Routes>
            {/* Public route */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Dashboard app routes */}
            <Route element={<AppLayout />}>
              {dashboardRoutes.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
            </Route>

            {/* Redirect fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </RoomsProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
