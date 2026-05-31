import { ExternalLinkIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,

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
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in new tab"
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover/menu-item:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLinkIcon className="size-3 text-muted-foreground/50" />
      </a>
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
