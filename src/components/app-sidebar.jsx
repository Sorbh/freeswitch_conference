"use client"

import * as React from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  UsersIcon,
  AudioLinesIcon,
  RadioIcon,
  PhoneIcon,
  PhoneCallIcon,
  ServerIcon,
  ActivityIcon,
  ScrollTextIcon,
  CloudIcon,
  BellIcon,
  MegaphoneIcon,
  TerminalIcon,
} from "lucide-react"

const teams = [
  {
    name: "HotlineHQ",
    logo: <PhoneIcon className="text-indigo-400" />,
    plan: "Hotline Console Admin",
  },
]

const allNavGroups = [
  {
    label: "Console",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon />, roles: ['admin', 'editor', 'analytics'] },
      { title: "Connected Yards", url: "/users", icon: <UsersIcon />, roles: ['admin', 'editor'] },
      { title: "Rooms", url: "/rooms", icon: <AudioLinesIcon />, roles: ['admin', 'editor'] },
      { title: "Broadcast History", url: "/broadcasts", icon: <RadioIcon />, roles: ['admin', 'editor', 'analytics'] },
      { title: "Extension Calls", url: "/direct-calls", icon: <PhoneCallIcon />, roles: ['admin', 'editor', 'analytics'] },
      { title: "Notifications", url: "/notifications", icon: <BellIcon />, roles: ['admin', 'editor'] },
      { title: "Announcements", url: "/announcements", icon: <MegaphoneIcon />, roles: ['admin', 'editor'] },
    ],
  },
  {
    label: "Developer",
    items: [
      { title: "Live Events", url: "/events", icon: <ActivityIcon />, roles: ['admin', 'editor', 'analytics'] },
      { title: "System Health", url: "/system", icon: <ServerIcon />, roles: ['admin'] },
      { title: "Server Logs", url: "/dev/server-logs", icon: <TerminalIcon />, roles: ['admin'] },
      { title: "FS Logs", url: "/dev/fs-logs", icon: <ScrollTextIcon />, roles: ['admin'] },
      { title: "Phone Log", url: "/dev/phone-logs", icon: <PhoneIcon />, roles: ['admin'] },
      { title: "YMCS Control", url: "/dev/ymcs", icon: <CloudIcon />, roles: ['admin'] },
    ],
  },
]

export function AppSidebar({ ...props }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const role = user?.role || 'analytics'

  const navGroups = allNavGroups
    .map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => item.roles.includes(role))
        .map((item) => ({
          ...item,
          isActive: location.pathname === item.url ||
            (item.url !== "/" && location.pathname.startsWith(item.url)),
          onClick: () => navigate(item.url),
        })),
    }))
    .filter((group) => group.items.length > 0)

  const userData = {
    name: user?.name || "User",
    email: user?.email || "",
    role: user?.role || "analytics",
    avatar: "",
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} onLogout={logout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
