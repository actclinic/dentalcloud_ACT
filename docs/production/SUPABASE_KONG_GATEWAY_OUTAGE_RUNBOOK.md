# Supabase / Kong Gateway Outage — Root Cause & Runbook

**Status:** Resolved on the Supabase host (167.86.78.69) on 2026-11-28.
**Symptom:** Frontend (`https://act2.dentalcloud.asia`) reported "backend down"; users
could not log in or load data. Browser surfaced `Failed to fetch` / CORS-style errors.

---

## 1. Topology

```
browser
  └─ https://act2.dentalcloud.asia          (47.79.35.105)  app nginx, serves SPA
       └─ location /supabase/  ──────────────► proxied to Supabase
            └─ https://167.86.78.69          (host nginx :443, TLS)
                 └─ http://127.0.0.1:8000    Kong 3.9.1 (dbless, declarative kong.yml)
                      ├─ auth:9999            GoTrue
                      ├─ rest:3000            PostgREST
                      ├─ storage:5000         storage-api
                      └─ realtime:4000        Realtime

second path (legacy / stale bundles still in the wild):
browser ─► Cloudflare (supabaseact.dentalcloud.asia) ─► 167.86.78.69 nginx ─► Kong
```

Because of the same-origin gateway (`services/supabase.ts` builds
`${window.location.origin}/supabase`), **all** clinic traffic now reaches the origin
from a single address, `47.79.35.105`. Traffic that still goes through Cloudflare
arrives from a small set of Cloudflare edge IPs instead of from individual users.

---

## 2. Root cause

`fail2ban` on the Supabase host ran a jail named `supabase-kong`:

```ini
[supabase-kong]
maxretry = 20
findtime = 60
bantime  = 3600
port     = http,https,8000,8443
logpath  = /var/log/nginx/access.log
filter   = supabase-kong   # matches ANY 400/401/403/404/429/500/502/503
```

The filter counts **any** 4xx/5xx request as a failure. Internet scanners constantly
probe the host (`/.env`, `/wp-login.php`, `/`, `/robots.txt`). Those probes are
proxied by Cloudflare, so they appear in `access.log` with a **Cloudflare edge IP** as
the client address.

Result: one Cloudflare edge IP accumulated 20+ failures within 60 s, fail2ban added it
to `addr-set-supabase-kong`, and nftables then `reject`ed that IP on ports
80/443/8000/8443 for one hour. Every real user routed through that edge got
*connection refused* — for them the backend simply disappeared.

Observed ban bursts (`/var/log/fail2ban.log`):

| time (server) | event |
|---|---|
| 2026-11-27 18:48:00 – 18:49:23 | 5 Cloudflare IPs banned in 82 s |
| 2026-11-27 21:58:31 – 21:58:47 | 3 Cloudflare IPs banned (172.69.40.215/214, 104.23.107.36) |
| 2026-11-28 02:03:57 | 5 Cloudflare IPs banned in the *same second* |
| daily | 5–31 `supabase-kong` bans/day |

`supabase-postflood` had the same class of bug and was worse: `bantime = 7200`
(2 hours) and **no `ignoreip` at all**.

Evidence that this was not a capacity problem:

* all 11 Supabase containers `healthy`, Kong reported `Kong is healthy` continuously,
* `access.log` showed **0 × 429** and no sustained 5xx for the previous 7 days,
* PostgREST returned `200` for real queries even while users were complaining,
* `nf_conntrack_count` 515 / 262144, memory 2.7 GB used of 7.9 GB, disk 14 %.

So the "Kong gateway limit" users hit was **fail2ban rejecting the CDN/gateway IP**,
not Kong rate limiting (no rate-limiting plugin exists in `kong.yml`).

---

## 3. Fix applied

File: `/etc/fail2ban/jail.local` (backed up to `/root/jail.local.bak-<timestamp>`).

* Moved the whitelist into `[DEFAULT] ignoreip` so **every** jail inherits it:
  loopback, RFC1918/Docker ranges, `47.79.35.105` (gateway), and all official
  Cloudflare ranges (from `https://api.cloudflare.com/client/v4/ips`).
* Removed the per-jail `ignoreip` override in `[supabase-kong]` — a section-level
  value *replaces* the default instead of extending it, which is why
  `supabase-postflood` previously had no protection.
* `[supabase-postflood]` now inherits the same whitelist.
* `ssh` protection left enabled and untouched (`sshd` jail, 99 IPs currently banned).

Verification performed with an isolated test jail (same filter, same `[DEFAULT]`):

```
Ignore 104.22.109.53 by ip        <- Cloudflare edge: correctly ignored
Found  203.0.113.77               <- ordinary IP
Ban    203.0.113.77               <- protection still works
```

---

## 4. Recovering this outage again (runbook)

```bash
# 1. Is the stack actually up?
docker ps --format '{{.Names}}\t{{.Status}}'
docker exec supabase-kong kong health

# 2. Is the gateway IP blocked?
fail2ban-client status supabase-kong
fail2ban-client status supabase-postflood
nft list set inet f2b-table addr-set-supabase-kong

# 3. Unblock immediately
fail2ban-client set supabase-kong unbanip <ip>
fail2ban-client set supabase-postflood unbanip <ip>
# or flush everything currently banned in a jail
for ip in $(fail2ban-client get supabase-kong banip); do
  fail2ban-client set supabase-kong unbanip "$ip"
done

# 4. Watch bans in real time
tail -f /var/log/fail2ban.log | grep -E 'Ban |Unban '
```

**Do not** re-add `ignoreip` inside a single jail section. Put shared ingress
addresses in `[DEFAULT] ignoreip`.

---

## 5. Gateway hardening

These live on the app host `47.79.35.105` (`act2.dentalcloud.asia`), which mirrors the
`Dockerfile` gateway in this repo.

**The repo has been hardened** — `Dockerfile` and `compose.production.yml` were updated
and the resulting nginx config was validated with a real `nginx -t` (exit 0). The
**live host still runs the old configuration**, because it was not reachable with the
credentials used for the Supabase server; apply the same changes there. The snippets
below are exactly what is now in the `Dockerfile`.

### 5.1 Full TCP + TLS handshake on every API call (~1 s added latency)

Measured from the public internet:

| path | latency |
|---|---|
| `https://supabaseact.dentalcloud.asia/rest/v1/patients` (direct) | ~0.13 s |
| `https://act2.dentalcloud.asia/supabase/rest/v1/patients` (gateway) | ~1.05 s |

`location /supabase/` uses `proxy_pass https://...` with no upstream keepalive, and
`map $http_upgrade $connection_upgrade` yields `Connection: close` for non-WebSocket
requests. Every REST call therefore pays a fresh TCP + TLS handshake.

Recommended:

```nginx
upstream supabase_backend {
    server 167.86.78.69:443;
    keepalive 64;
    keepalive_requests 1000;
    keepalive_timeout 60s;
}

map $http_upgrade $supabase_connection {
    default upgrade;   # WebSocket (Realtime)
    ''      '';        # keepalive for normal HTTP
}

location /supabase/ {
    proxy_pass https://supabase_backend/;
    proxy_http_version 1.1;
    proxy_set_header Connection $supabase_connection;
    proxy_ssl_server_name on;
    proxy_ssl_name supabaseact.dentalcloud.asia;
    proxy_ssl_verify on;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_set_header Host supabaseact.dentalcloud.asia;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_connect_timeout 5s;
    proxy_read_timeout 3600s;
    proxy_send_timeout 60s;
}
```

### 5.2 Uploads above 1 MB fail with `413`

`Dockerfile` sets no `client_max_body_size` in the gateway `server` block, so nginx
defaults to `1m`. Patient files / photos uploaded through `/supabase/storage/v1/...`
are rejected. The Supabase-side host nginx already allows `50M`. Add:

```nginx
client_max_body_size 50M;
```

### 5.3 Gateway sizing

The previous `Dockerfile` used `worker_processes 1`, `worker_connections 1024`,
`worker_rlimit_nofile 4096`, and `compose.production.yml` capped the container at
`cpus: 0.50`, `mem_limit: 128m`, `pids_limit: 100` — one worker carrying **all** auth,
REST, storage and Realtime traffic for every clinic.

Now applied in this repo:

| setting | before | after |
|---|---|---|
| `worker_processes` | `1` | `auto` |
| `worker_connections` | `1024` | `4096` |
| `worker_rlimit_nofile` | `4096` | `8192` |
| `multi_accept` | `off` | `on` |
| `keepalive_timeout` (client) | `15` | `65` |
| `cpus` | `0.50` | `1.0` |
| `mem_limit` | `128m` | `256m` |
| `pids_limit` | `100` | `200` |
| `ulimits.nofile` | `1024/4096` | `8192/16384` |

`ulimits.nofile` **must** stay at or above `worker_rlimit_nofile`, otherwise nginx
fails to start.

### 5.4 Gateway IP is not pinned — mitigated

`ignoreip` contains the literal `47.79.35.105`, so a gateway re-IP would previously
re-introduce the lockout. The auto-healing guard in section 7 removes that risk by
re-detecting the ingress address every 2 minutes. Pinning a static/elastic IP (or
moving the gateway onto the Supabase host so only loopback is involved) is still
preferred.

---

## 6. Security follow-ups

* Kong exposes `8000`, `8443`, `5432` (pooler) and `6543` on `0.0.0.0`. UFW currently
  only allows 22/80/443, which is the only thing protecting the pooler — bind those
  ports to `127.0.0.1` in the Supabase compose file instead of relying on the firewall.
* Rotate the server root password and use key-based SSH; the password was shared in
  plain text during this incident.

---

## 7. Prevention (implemented)

Four independent layers now stop this outage from recurring.

### 7.1 Whitelist shared ingress in `[DEFAULT] ignoreip`

`/etc/fail2ban/jail.local` lists loopback, RFC1918/Docker ranges, the app gateway and
every official Cloudflare range in `[DEFAULT] ignoreip`, so **all** jails inherit them.
A section-level `ignoreip` must never be re-added — it replaces the default instead of
extending it.

### 7.2 Auto-healing guard (survives IP changes)

`/usr/local/bin/supabase-ingress-guard.sh`, driven by
`supabase-ingress-guard.timer` every **2 minutes**:

1. finds every address currently serving app traffic (any address with the
   `https://act2.dentalcloud.asia/` referer, plus any address above 200 requests in the
   last 20k log lines);
2. **immediately unbans** each one from every jail;
3. persists them into `/etc/fail2ban/jail.d/zz-ingress-guard.local`, validates the
   config with `fail2ban-client -t`, reloads, and **rolls back automatically** if the
   generated config is ever invalid;
4. probes `http://127.0.0.1:8000/storage/v1/status` and logs a warning on failure.

Log: `/var/log/supabase-ingress-guard.log`. The script is idempotent — it only reloads
when the address set actually changes.

```bash
systemctl status supabase-ingress-guard.timer
systemctl list-timers supabase-ingress-guard.timer
tail -20 /var/log/supabase-ingress-guard.log
journalctl -u supabase-ingress-guard.service -n 30
/usr/local/bin/supabase-ingress-guard.sh    # run manually
```

SSH protection is unaffected: only addresses carrying the application are whitelisted,
so `sshd` still bans brute-forcers normally.

### 7.3 Gateway hardened in the repo

See section 5 — keepalive upstream pool, `client_max_body_size 50m`, correct
`Connection` handling and realistic worker/container limits. Config validated with
`nginx -t`.

### 7.4 Never certify on Kong/API health alone

The "is it up?" check that mattered during this incident was **not**
`docker ps` / `kong health` (both were green the whole time) but an actual request
through the path users take:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: <ANON_KEY>" \
  'https://act2.dentalcloud.asia/supabase/rest/v1/patients?select=id&limit=1'
```

Run that both directly against `supabaseact.dentalcloud.asia` **and** through the
gateway when investigating any "backend down" report — a difference between the two
points straight at the gateway hop.
