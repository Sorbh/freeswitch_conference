---
title: "Enterprise Security"
accent: "#64748b"
seo:
  title: "Enterprise Security — Production-Grade Voice Network | Hotline HQ"
  description: "JWT authentication, rate limiting, SIP digest auth, encrypted connections, and role-based access control. Built for always-on, production voice networks."
  keywords: "secure hotline, enterprise voice security, SIP authentication, encrypted conference, production grade hotline"
hero:
  kicker: "SECURITY"
  heading: "Built for always-on production"
  lede: "JWT authentication, rate limiting, SIP digest auth, encrypted WebSocket connections, and role-based access control. The infrastructure runs 24/7 with zero planned downtime."
problem:
  heading: "Voice networks are targets"
  text: "An always-on voice network that's connected to hundreds of SIP phones is a high-value target for toll fraud, unauthorized access, and abuse. Security can't be an afterthought — it has to be the foundation."
steps:
  - title: "SIP digest authentication"
    desc: "Every phone must authenticate with FreeSWITCH using SIP digest auth before joining a room. Unauthorized User-Agents are silently rejected."
  - title: "JWT token auth"
    desc: "The web client uses JWT access tokens (15-minute expiry) with refresh tokens (7-day expiry). Tokens are rotated automatically."
  - title: "Rate limiting & lockout"
    desc: "Login attempts are limited to 5 per 15 minutes per IP. After 5 failed attempts, the account is locked for 15 minutes."
  - title: "Encrypted transport"
    desc: "All web traffic runs over HTTPS/TLS. SIP signaling uses WSS (WebSocket Secure). No plaintext communication."
benefits:
  - title: "UA allowlist"
    desc: "Only Yealink phones and the Hotline HQ web client are allowed to register. All other SIP User-Agents are rejected and can be blocklisted."
  - title: "Role-based admin access"
    desc: "Three admin roles: Admin (full), Editor (users/rooms/notifications), Analytics (read-only). Principle of least privilege."
  - title: "Listener session isolation"
    desc: "Public listen-in sessions use ephemeral SIP credentials with 60-second auth TTL, single-use tokens, and 20 concurrent session cap."
  - title: "Security headers"
    desc: "X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers on every response. The server fingerprint is suppressed."
scenario:
  heading: "Real-world: blocking a toll fraud attempt"
  text: "An unknown SIP User-Agent attempts to register with the FreeSWITCH server. The directory endpoint checks the UA string, finds it's not a Yealink or web client, and returns a 403. The admin sees the blocked attempt in the SIP logs and adds the UA to the blocklist. The attacker never reaches the conference."
faqs:
  - q: "Is call audio encrypted?"
    a: "SIP signaling is encrypted via WSS (WebSocket Secure). The audio stream uses SRTP when supported by the endpoint. All web traffic is over HTTPS."
  - q: "Can unauthorized phones connect to the network?"
    a: "No. The FreeSWITCH directory endpoint validates every registration against the account database and checks the SIP User-Agent. Unknown devices are rejected."
  - q: "How are admin accounts secured?"
    a: "Admin accounts use bcrypt-hashed passwords, JWT tokens with short expiry, refresh token rotation, and rate-limited login with account lockout after failed attempts."
  - q: "Is there an audit log?"
    a: "Yes. Every significant event — user joins, leaves, mutes, unmutes, broadcasts, direct calls, room changes, admin actions — is logged in the event log with timestamps."
  - q: "What happens during a server restart?"
    a: "The server performs a graceful shutdown: all active calls receive a BYE signal, recordings are saved, and the process exits cleanly. Phones reconnect automatically when the server comes back online."
related:
  - admin-dashboard
  - always-on-voice-network
  - broadcast-recording
---
