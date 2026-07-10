---
title: "Admin Dashboard"
accent: "#4f46e5"
seo:
  title: "Admin Dashboard — Real-Time Network Control | Hotline HQ"
  description: "Full network visibility from one screen. Real-time user status, broadcast analytics, room management, phone health monitoring, and system diagnostics."
  keywords: "hotline admin panel, network management dashboard, broadcast analytics, real-time monitoring, conference room management"
hero:
  kicker: "MANAGEMENT"
  heading: "Full control from one screen"
  lede: "Real-time user status, broadcast analytics, room management, phone health monitoring, and system diagnostics. Everything a network operator needs — nothing they don't."
problem:
  heading: "Running a network blind is dangerous"
  text: "Without visibility, operators can't tell if members are online, if rooms are active, or if phones are working. Problems go unnoticed for hours. The admin dashboard gives operators complete real-time visibility into every aspect of the network."
steps:
  - title: "Live overview"
    desc: "The dashboard homepage shows real-time stats: users online, in conference, active broadcasts, with a scrolling event ticker and room activity timelines."
  - title: "User management"
    desc: "See every member's status (online, offline, muted, talking, error) with smart suggestions for common issues. Bulk actions: reconnect all, mute all, kick all."
  - title: "Broadcast analytics"
    desc: "Charts for broadcast volume, response rates, top broadcasters, peak hours. Filter by room, time range, answered/unanswered."
  - title: "System health"
    desc: "FreeSWITCH connection status, server uptime, database size, memory usage, SIP registration count — with auto-alerts for anomalies."
benefits:
  - title: "Real-time SSE updates"
    desc: "Every dashboard page updates live via Server-Sent Events. No page refreshes, no polling — changes appear the instant they happen."
  - title: "Smart diagnostics"
    desc: "The user detail panel shows smart suggestions: \"UDP/NAT issue detected,\" \"Phone unreachable for 5 minutes,\" \"Stuck in connecting state.\" Operators know what to fix."
  - title: "Role-based access"
    desc: "Three admin roles: Admin (full access), Editor (users and rooms), Analytics (read-only). Each operator sees only what they need."
  - title: "Remote phone control"
    desc: "Reboot phones, push configurations, update SIP servers, and rebind devices — all from the dashboard. No on-site visits."
scenario:
  heading: "Real-world: diagnosing a silent yard"
  text: "An operator notices a yard that's been online but silent for 3 days. They open the user detail panel and see: \"No syslog events in 72 hours — phone may be powered off or network-disconnected.\" They tap \"Reboot\" to send a remote restart command. 30 seconds later, the phone reconnects and the yard is back on the hotline."
faqs:
  - q: "Can multiple admins use the dashboard simultaneously?"
    a: "Yes. The dashboard supports multiple concurrent admin sessions. All admins see the same real-time data via SSE."
  - q: "What analytics are available?"
    a: "Broadcast volume charts, response rate tracking, hourly distribution, top broadcasters by room, user availability timelines, and room capacity utilization."
  - q: "Can I export data from the dashboard?"
    a: "Yes. FreeSWITCH logs, phone logs, and server logs all support CSV export. Broadcast data is available via the API."
  - q: "Is there an API for integrating with other systems?"
    a: "Yes. The admin API supports user management, room management, and broadcast data. API keys can be generated and revoked from the Settings page."
related:
  - caller-id
  - broadcast-recording
  - notifications
---
