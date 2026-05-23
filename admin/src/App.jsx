import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import DashboardPage from "@/pages/DashboardPage";
import UsersPage from "@/pages/UsersPage";
import RoomsPage from "@/pages/RoomsPage";
import BroadcastsPage from "@/pages/BroadcastsPage";
import HistoryPage from "@/pages/HistoryPage";
import SystemPage from "@/pages/SystemPage";
import EventsPage from "@/pages/EventsPage";

const routes = [
  { path: "/", element: <DashboardPage />, title: "Dashboard" },
  { path: "/users", element: <UsersPage />, title: "Users" },
  { path: "/rooms", element: <RoomsPage />, title: "Conference Rooms" },
  { path: "/broadcasts", element: <BroadcastsPage />, title: "Broadcasts" },
  { path: "/history", element: <HistoryPage />, title: "Online History" },
  { path: "/system", element: <SystemPage />, title: "System Health" },
  { path: "/events", element: <EventsPage />, title: "Live Events" },
];

function BreadcrumbNav() {
  const location = useLocation();
  const currentRoute = routes.find(
    (r) => r.path === location.pathname || (r.path !== "/" && location.pathname.startsWith(r.path))
  ) || routes[0];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="text-muted-foreground">Redline SIP</BreadcrumbPage>
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
            <ThemeToggle className="ml-auto" />
          </header>
          <div className="flex-1 overflow-auto p-6">
            <Routes>
              {routes.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}
            </Routes>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="redline-ui-theme">
      <BrowserRouter basename="/admin">
        <AppLayout />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
