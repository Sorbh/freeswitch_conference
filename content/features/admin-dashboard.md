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
  text: "Without visibility, operators fly blind. Are members online? Are rooms active? Are phones even working? Problems slide by for hours before anyone notices. The dashboard puts the full picture in front of you — live, on one screen."
steps:
  - title: "Live overview"
    desc: "The dashboard homepage shows real-time stats: users online, in conference, active broadcasts, with a scrolling event ticker and room activity timelines."
  - title: "User management"
    desc: "See every member's status — online, offline, muted, talking, error — with smart suggestions for common issues. Bulk actions: reconnect all, mute all, kick all."
  - title: "Broadcast analytics"
    desc: "Charts for broadcast volume, response rates, top broadcasters, peak hours. Filter by room, time range, answered or unanswered."
  - title: "System health"
    desc: "FreeSWITCH connection status, server uptime, database size, memory usage, SIP registration count. Auto-alerts fire when something looks off."
benefits:
  - title: "Real-time SSE updates"
    desc: "Every dashboard page updates live via Server-Sent Events. No page refreshes, no polling — changes show up the instant they happen."
  - title: "Smart diagnostics"
    desc: "The user detail panel flags problems for you: \"UDP/NAT issue detected,\" \"Phone unreachable for 5 minutes,\" \"Stuck in connecting state.\" You know what to fix without digging."
  - title: "Role-based access"
    desc: "Three admin roles: Admin (full access), Editor (users and rooms), Analytics (read-only). Each operator sees only what they need."
  - title: "Remote phone control"
    desc: "Reboot phones, push configurations, update SIP servers, rebind devices — all from the dashboard. No driving out to the yard."
scenario:
  heading: "Real-world: diagnosing a silent yard"
  text: "An operator notices a yard that's been online but silent for 3 days. They open the user detail panel and see: \"No syslog events in 72 hours — phone may be powered off or network-disconnected.\" They tap \"Reboot\" to send a remote restart. 30 seconds later, the phone reconnects and the yard is back on the hotline."
faqs:
  - q: "Can multiple admins use the dashboard simultaneously?"
    a: "Yes. The dashboard handles multiple admin sessions at once. All admins see the same real-time data via SSE."
  - q: "What analytics are available?"
    a: "Broadcast volume charts, response rate tracking, hourly distribution, top broadcasters by room, user availability timelines, and room capacity utilization."
  - q: "Can I export data from the dashboard?"
    a: "Yes. FreeSWITCH logs, phone logs, and server logs all support CSV export. Broadcast data is also available through the API."
  - q: "Is there an API for integrating with other systems?"
    a: "Yes. The admin API covers user management, room management, and broadcast data. Generate and revoke API keys from the Settings page."
related:
  - caller-id
  - broadcast-recording
  - notifications
---
