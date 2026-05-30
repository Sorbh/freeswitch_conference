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
  ClockIcon,
  ServerIcon,
  ActivityIcon,
  PhoneIcon,
  CodeIcon,
  ScrollTextIcon,
} from "lucide-react"

const data = {
  user: {
    name: "Admin",
    email: "admin@redline.com",
    avatar: "",
  },
  teams: [
    {
      name: "Redline SIP",
      logo: <PhoneIcon />,
      plan: "Conference Admin",
    },
  ],
  navGroups: [
    {
      label: "Platform",
      items: [
        { title: "Dashboard", url: "/", icon: <LayoutDashboardIcon /> },
        { title: "Users", url: "/users", icon: <UsersIcon /> },
        { title: "Conference Rooms", url: "/rooms", icon: <AudioLinesIcon /> },
        { title: "Broadcasts", url: "/broadcasts", icon: <RadioIcon /> },
        { title: "Online History", url: "/history", icon: <ClockIcon /> },
        { title: "Live Events", url: "/events", icon: <ActivityIcon /> },
      ],
    },
    {
      label: "Developer",
      items: [
        { title: "System Health", url: "/system", icon: <ServerIcon /> },
        { title: "FS Logs", url: "/dev/fs-logs", icon: <ScrollTextIcon /> },
        { title: "Phone Log", url: "/dev/phone-logs", icon: <PhoneIcon /> },
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
