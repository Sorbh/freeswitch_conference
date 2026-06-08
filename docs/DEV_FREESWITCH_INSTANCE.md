# Dev FreeSWITCH Instance Setup Plan

Run a second FreeSWITCH instance on the same machine for debugging individual phones without affecting production.

## Why

When a device has issues, switch it to the dev instance via YMCS "Update SIP Server" to debug in isolation. Switch back to production when done.

## Port Allocation

| Resource   | Production | Development |
|------------|-----------|-------------|
| SIP Port   | 5070      | 5080        |
| ESL Port   | 8021      | 8022        |
| RTP Range  | 16384-24576 | 24577-32768 |

## Setup Steps

1. Clone production FreeSWITCH config to a separate directory:
   ```bash
   cp -r /etc/freeswitch /etc/freeswitch-dev
   ```

2. Update ports in dev config:
   - `sip_profiles/` — change SIP listen port to 5080
   - `autoload_configs/event_socket.conf.xml` — change ESL port to 8022
   - `autoload_configs/switch.conf.xml` — change RTP range to 24577-32768

3. Create separate DB and log directories:
   ```bash
   mkdir -p /var/lib/freeswitch-dev/db
   mkdir -p /var/log/freeswitch-dev
   ```

4. Launch dev instance:
   ```bash
   freeswitch -conf /etc/freeswitch-dev -db /var/lib/freeswitch-dev/db -log /var/log/freeswitch-dev
   ```

5. Connect via fs_cli:
   ```bash
   fs_cli -H 127.0.0.1 -P 8022 -p redline_fs_2024
   ```

## Switching a Phone to Dev

Use the YMCS "Update SIP Server" button in the user detail sheet:
- **Dev**: set host `50.28.84.57`, port `5080`
- **Production**: set host `50.28.84.57`, port `5070`

## Notes

- Dev instance runs independently — no impact on production calls
- Consider adding it as a pm2 service for easy start/stop
- May need a second HotlineHQ backend instance pointing to ESL port 8022 for full admin control (optional)
