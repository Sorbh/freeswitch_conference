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
  text: "An always-on voice network connected to hundreds of SIP phones is a prime target for toll fraud, unauthorized access, and abuse. Security can't be bolted on later — it has to be the foundation."
steps:
  - title: "SIP digest authentication"
    desc: "Every phone must authenticate with FreeSWITCH using SIP digest auth before joining a room. Unauthorized User-Agents get silently rejected."
  - title: "JWT token auth"
    desc: "The web client uses JWT access tokens (15-minute expiry) with refresh tokens (7-day expiry). Tokens rotate automatically."
  - title: "Rate limiting & lockout"
    desc: "Login attempts are capped at 5 per 15 minutes per IP. After 5 failures, the account locks for 15 minutes."
  - title: "Encrypted transport"
    desc: "All web traffic runs over HTTPS/TLS. SIP signaling uses WSS (WebSocket Secure). Nothing goes over plaintext."
benefits:
  - title: "UA allowlist"
    desc: "Only Yealink phones and the Hotline HQ web client can register. Everything else gets rejected. Persistent offenders go on the blocklist."
  - title: "Role-based admin access"
    desc: "Three admin roles: Admin (full), Editor (users/rooms/notifications), Analytics (read-only). Principle of least privilege."
  - title: "Listener session isolation"
    desc: "Public listen-in sessions use ephemeral SIP credentials with 60-second auth TTL, single-use tokens, and a 20 concurrent session cap."
  - title: "Security headers"
    desc: "X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers on every response. Server fingerprint is suppressed."
scenario:
  heading: "Real-world: blocking a toll fraud attempt"
  text: "An unknown SIP User-Agent tries to register with the FreeSWITCH server. The directory endpoint checks the UA string, finds it's not a Yealink or web client, and returns a 403. The admin sees the blocked attempt in the SIP logs and adds the UA to the blocklist. The attacker never reaches the conference."
faqs:
  - q: "Is call audio encrypted?"
    a: "SIP signaling is encrypted via WSS. The audio stream uses SRTP when the endpoint supports it. All web traffic goes over HTTPS."
  - q: "Can unauthorized phones connect to the network?"
    a: "No. The FreeSWITCH directory endpoint validates every registration against the account database and checks the SIP User-Agent. Unknown devices get rejected."
  - q: "How are admin accounts secured?"
    a: "Bcrypt-hashed passwords, JWT tokens with short expiry, refresh token rotation, and rate-limited login with account lockout after failed attempts."
  - q: "Is there an audit log?"
    a: "Yes. Every event worth tracking — joins, leaves, mutes, unmutes, broadcasts, direct calls, room changes, admin actions — gets logged with timestamps."
  - q: "What happens during a server restart?"
    a: "The server shuts down gracefully: active calls receive a BYE signal, recordings are saved, and the process exits clean. Phones reconnect on their own when the server comes back."
related:
  - admin-dashboard
  - always-on-voice-network
  - broadcast-recording
resources:
  - label: Salvage yard software compared
    href: /blog/guides/salvage-yard-software-compared
  - label: Own a hotline in your industry
    href: /own-a-hotline
  - label: The auto dismantler business guide
    href: /blog/guides/auto-dismantler-business-guide
---
