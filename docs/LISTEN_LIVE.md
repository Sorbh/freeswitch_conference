# Listen Live — public landing-page listening

Visitors on the landing page can listen to a live room, listen-only, with
sanitized caller cards. Shipped in three parts; parts 1 and 3 are app code,
part 2 is a FreeSWITCH dialplan addition applied in a maintenance window.

## How it works

1. Landing page calls `POST /api/v1/public/listen/session { room }`.
   The server mints a one-time SIP user (`listener-<nonce>`, random password,
   60s auth TTL) in `service/listenerSessions.js`. Caps: 20 concurrent public
   listeners, 3 per IP, 10 mints/IP/hour.
2. Browser loads `/jssip.bundle.js`, opens the existing WSS profile, and calls
   `sip:listen-<room>@<domain>` with a silent mic stream
   (`client/src/hooks/useListenLive.js`).
3. FS digest-auths against `POST /api/v1/freeswitch/directory`, which resolves
   `listener-*` users from the in-memory session map and returns
   `user_context=public_listen` — isolating listeners from the default
   dialplan (they cannot dial rooms/extensions/users).
4. The `public_listen` context (below) joins them to the conference
   force-muted with DTMF caller controls disabled.
5. Caller cards come from `GET /api/v1/public/listen/events/:room` (public SSE,
   company name + state only).

Admin room monitoring (`admin-listen`) now also uses ephemeral credentials via
`POST /api/v1/admin/listen/session` — the static `admin-listen` password was
removed from the directory endpoint and the admin bundle.

## Part 2 — dialplan (applied 2026-07-05)

Source of truth: `config/freeswitch/dialplan/public_listen.xml` (deployed by
`install_freeswitch.sh --sync`, or by hand with `cp` + `reloadxml` — note
`--sync` restarts FreeSWITCH and drops live calls; prefer the manual copy).
Live copy: `freeswitch/etc/freeswitch/dialplan/public_listen.xml`.

```xml
<include>
  <context name="public_listen">
    <extension name="listen_only_conference">
      <condition field="destination_number" expression="^listen-(\d+)$">
        <!-- no DTMF conference controls for public listeners -->
        <action application="set" data="conference_controls=none"/>
        <action application="answer"/>
        <action application="conference" data="$1@redline-hotline++flags{mute}"/>
      </condition>
    </extension>
    <!-- anything else dialed from this context dies here -->
    <extension name="deny_all">
      <condition field="destination_number" expression=".*">
        <action application="hangup" data="CALL_REJECTED"/>
      </condition>
    </extension>
  </context>
</include>
```

Then `reloadxml` from fs_cli. No restart needed; zero impact on live calls.

Until this context exists, public listen attempts fail at the dialplan
(hangup) — the feature is inert but safe to deploy.

## Security model

- No static SIP credentials anywhere in public bundles.
- Credentials are single-purpose: random, 60s auth window, 30s reuse window
  after first auth (FS hits the directory more than once per INVITE), then dark.
- Listen-only is enforced server-side (`flags{mute}` + `conference_controls=none`
  + isolated context). Client-side silent stream is cosmetic.
- `deny_all` catch-all: a listener credential cannot reach the default context's
  numeric room route (which joins unmuted) or any other destination.
- SSE exposes company name + state only. Caps on SSE connections too
  (100 global / 5 per IP).
