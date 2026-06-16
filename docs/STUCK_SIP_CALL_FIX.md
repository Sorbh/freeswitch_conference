# Fixing Stuck SIP Calls (Session Timer Loop)

## Problem

Yealink phones send `UPDATE` requests with `Session-Expires: 120;refresher=uac` to keep the SIP session alive. Drachtio auto-responds `200 OK` to these UPDATEs, so the call stays alive indefinitely — even when the conference/media session is gone.

## Solution: iptables Block

Block the server's outgoing responses for the stuck call's Call-ID. The phone's next UPDATE gets no response, the session timer expires (120s), and the phone tears down the call.

### Step 1: Get Call-ID, Phone IP and Port from PCAP

```bash
tcpdump -r <pcap_file> -vvv -A 2>/dev/null | grep -E "Session-Expires|Call-ID|From:|Contact:|UPDATE"
```

Look for:
- `Call-ID:` — unique call identifier
- `Contact:` — phone's public IP and port (e.g., `sip:user@75.80.236.8:1024`)
- `Session-Expires: 120;refresher=uac` — confirms the session timer loop

### Step 2: Block Responses

```bash
iptables -I OUTPUT -p udp -d <PHONE_IP> --dport <PHONE_PORT> \
  -m string --string "<CALL_ID>" --algo bm -j DROP
```

Example:
```bash
iptables -I OUTPUT -p udp -d 75.80.236.8 --dport 1024 \
  -m string --string "4961dad6-de96-123f-c9a6-d404e6faf0f0" --algo bm -j DROP
```

### Step 3: Wait ~2-3 Minutes

The phone should drop the call after the session timer expires (120 seconds).

### Step 4: Remove the Rule

```bash
iptables -D OUTPUT -p udp -d <PHONE_IP> --dport <PHONE_PORT> \
  -m string --string "<CALL_ID>" --algo bm -j DROP
```

## Notes

- **Always use Call-ID in the rule** — blocking by IP:port alone would also block registrations, new calls, and NOTIFYs to that phone.
- The call can also be checked/kicked from FreeSWITCH side: `conference <room> kick <member_id>`
- PCAP files can be downloaded from YMCS panel for the device.
