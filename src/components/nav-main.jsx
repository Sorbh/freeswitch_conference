import { ExternalLinkIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
} from "@/components/ui/sidebar"

function NavItem({ item }) {
  return (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        tooltip={item.title}
        isActive={item.isActive}
        onClick={item.onClick}
      >
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
      <SidebarMenuAction asChild>
        <a href={item.url} target="_blank" rel="noopener noreferrer" title="Open in new tab">
          <ExternalLinkIcon className="size-3 text-muted-foreground/50" />
        </a>
      </SidebarMenuAction>
    </SidebarMenuItem>
  )
}

export function NavMain({ items, groups }) {
  if (groups) {
    return groups.map((group) => (
      <SidebarGroup key={group.label}>
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
        <SidebarMenu>
          {group.items.map((item) => (
            <NavItem key={item.title} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroup>
    ));
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavItem key={item.title} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
