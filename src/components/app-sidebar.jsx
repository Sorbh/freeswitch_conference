"use client"

import * as React from "react"
import { useNavigate, useLocation } from "react-router-dom"

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
  ServerIcon,
  ActivityIcon,
  CodeIcon,
  ScrollTextIcon,
  CloudIcon,
} from "lucide-react"

const data = {
  user: {
    name: "Admin",
    email: "admin@hotlinehq.com",
    avatar: "",
  },
  teams: [
    {
      name: "HotlineHQ",
      logo: <PhoneIcon className="text-indigo-400" />,
      plan: "Hotline Console Admin",
    },
  ],
  navGroups: [
    {
      label: "Console",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: <LayoutDashboardIcon /> },
        { title: "Connected Yards", url: "/users", icon: <UsersIcon /> },
        { title: "Rooms", url: "/rooms", icon: <AudioLinesIcon /> },
        { title: "Broadcast History", url: "/broadcasts", icon: <RadioIcon /> },
      ],
    },
    {
      label: "Developer",
      items: [
        { title: "Live Events", url: "/events", icon: <ActivityIcon /> },
        { title: "System Health", url: "/system", icon: <ServerIcon /> },
        { title: "FS Logs", url: "/dev/fs-logs", icon: <ScrollTextIcon /> },
        { title: "Phone Log", url: "/dev/phone-logs", icon: <PhoneIcon /> },
        { title: "YMCS Control", url: "/dev/ymcs", icon: <CloudIcon /> },
      ],
    },
  ],
}

export function AppSidebar({ ...props }) {
  const navigate = useNavigate()
  const location = useLocation()

  const navGroups = data.navGroups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      ...item,
      isActive: location.pathname === item.url ||
        (item.url !== "/" && location.pathname.startsWith(item.url)),
      onClick: () => navigate(item.url),
    })),
  }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
