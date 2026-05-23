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
  UserPlusIcon,
  AudioLinesIcon,
  RadioIcon,
  ClockIcon,
  ServerIcon,
  ActivityIcon,
  PhoneIcon,
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
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <LayoutDashboardIcon />,
      isActive: true,
    },
    {
      title: "Accounts",
      url: "/accounts",
      icon: <UserPlusIcon />,
    },
    {
      title: "Users",
      url: "/users",
      icon: <UsersIcon />,
    },
    {
      title: "Conference Rooms",
      url: "/rooms",
      icon: <AudioLinesIcon />,
    },
    {
      title: "Broadcasts",
      url: "/broadcasts",
      icon: <RadioIcon />,
    },
    {
      title: "Online History",
      url: "/history",
      icon: <ClockIcon />,
    },
    {
      title: "System Health",
      url: "/system",
      icon: <ServerIcon />,
    },
    {
      title: "Live Events",
      url: "/events",
      icon: <ActivityIcon />,
    },
  ],
}

export function AppSidebar({ ...props }) {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = data.navMain.map((item) => ({
    ...item,
    isActive: location.pathname === item.url ||
      (item.url !== "/" && location.pathname.startsWith(item.url)),
    onClick: () => navigate(item.url),
  }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
