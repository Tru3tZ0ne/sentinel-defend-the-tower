# Intranet HTTPS deployment and persistent scores

This deployment preserves the matte-arena Last Stand game from `95576af` and adds
a same-origin, durable leaderboard. It does not change combat, rendering, product
modules, Agent Builder, the 120-second campaign, or ten-second upgrade choices.

## Architecture

The isolated Debian 12 host uses its existing Python 3.11, SQLite and OpenSSL.
No package downloads, default route, firewall changes, external API, CDN or cloud
database are required. A bounded threaded HTTPS service serves the static game
and the API on port 443. This is a small intranet/event deployment, not an
Internet-scale hosting stack. TLS handshakes have timeouts and share a 64-client
concurrency limit; hardware/network capacity still determines event capacity.

| Location | Purpose |
| --- | --- |
| `/srv/sentinel/releases/RELEASE/game` | Versioned public game files |
| `/srv/sentinel/current` | Active game symlink |
| `/opt/sentinel-server` | Active server-code symlink |
| `/var/lib/sentinel/scores.sqlite3` | Authoritative persistent database, outside releases |
| `/var/backups/sentinel` | Last 30 consistent SQLite snapshots |
| `/etc/sentinel/tls` | Server certificate and restricted private key |
| `/root/sentinel-ca` | Root-only private CA signing material |
| `/etc/sentinel/ca.crt` | Public CA certificate to distribute to clients |

`sentinel.service` runs as a dedicated unprivileged account with only the
low-port bind capability, a read-only filesystem apart from its data directory,
automatic restart, and startup at boot. `sentinel-backup.timer` runs daily around
03:15 server time and catches up after downtime. Backups are on the same VM:
copy them to a separate protected system to survive loss of the VM or disk.

## Scores and honest UI

Only victories enter the ranking, preserving existing behavior. Every accepted
victory remains in SQLite, including repeated plays by the same name. The UI
shows the top 50; records beyond that limit are retained, and the submit response
reports the player's rank across the complete database. Ties share a rank.
SQLite WAL and full synchronous commits protect committed records across
service restarts. Reusing an attempt UUID retries the same result without a
duplicate; changing the result for an existing UUID is rejected.

The host supplies `/deployment-config.js` with a relative `/api/stand` endpoint
and server-required mode. In that mode, browser records cannot contaminate the
shared board. Successful submissions show a server confirmation. A failed
submission shows an explicit warning and Retry Save button, using the same UUID.
Keep the result page open until confirmation: an unsubmitted result is held in
memory, so closing that page loses that pending result. Existing browser-only
history is not automatically imported. GitHub Pages retains its local behavior.

The server validates completion (120 seconds, three bosses, victory), bounded
integer dimensions and the existing weighted score:
`floor(health * .55 + business * .25 + ai * .12 + agent * .08)`.
Server timestamps replace client timestamps. Names and metadata are bounded;
request bodies are limited to 8 KiB; cross-origin browser submissions are
rejected. This validates data consistency, **not cheat-proof play**: a determined
client can forge a plausible result. There is no player authentication in this
event leaderboard.

## Install / update

On a trusted workstation:

```powershell
python server/package_release.py C:/private/sentinel-release.tar.gz
```

Transfer the bundle through the approved SSH jump host. On the target, extract
to a new staging directory and run:

```sh
sudo sh /path/to/staging/server/install.sh RELEASE_VERSION PRIVATE_IPV4
```

Use a new release name for every update. The installer creates the service
account, versioned release, persistent directories, certificates and systemd
units. It reuses existing CA/server keys, switches the static and backend
symlinks, restarts the service, validates HTTPS, and takes a backup. It never
replaces an existing release or deletes the score database. The private IP and
credentials are operator inputs and must not be committed.

The root CA lasts ten years; the server certificate lasts one year. SANs contain
the supplied private IPv4, `127.0.0.1`, and `localhost`. Distribute only `ca.crt`,
never either private key. Users must explicitly trust this CA in their browser
or current-user operating-system root store. An SSH tunnel can expose remote
443 as local `127.0.0.1:8443`; it must bind loopback only. Direct clients must
already have a network path to the private IP. HTTPS adds no such route.

Check certificate dates well before an event:

```sh
openssl x509 -noout -dates -in /etc/sentinel/tls/server.crt
openssl x509 -checkend 2592000 -noout -in /etc/sentinel/tls/server.crt
```

To renew, retain the existing key and CSR, sign the CSR with the same CA and
`server.ext` into a temporary certificate, verify its IP SAN and CA chain, then
install it as `/etc/sentinel/tls/server.crt` (root:sentinel, mode 644) and restart
`sentinel`. Keep the old certificate for rollback. No client CA reimport is
needed when the same CA signs the renewal.

## Health, backups and rollback

```sh
systemctl status sentinel --no-pager
systemctl is-enabled sentinel sentinel-backup.timer
journalctl -u sentinel --since today
curl --fail --cacert /etc/sentinel/ca.crt https://127.0.0.1/api/health
systemctl list-timers sentinel-backup.timer
sudo systemctl start sentinel-backup.service
```

Use `backup.py` / the backup service rather than copying a live WAL database.
Before restoring, stop `sentinel`, preserve the current database together with
its WAL/SHM files in a dated recovery directory, then copy a verified backup to
the database path, set owner sentinel:sentinel and mode 600, and restart. Restore
only in a maintenance window because replacing the database discards records
newer than the selected backup. Test restore to a temporary database first.

For code rollback, stop the service, switch **both** symlinks to a previous
release's `game` and `server` directories, then start and verify health. Do not
replace the data directory. The v1 schema is additive and does not require a
database rollback. Keep original root CA material in protected administrative
backups if future renewals are required.

## Validation

```powershell
python -m unittest discover -s server -p test_app.py
node --test tools/board-server.test.mjs tools/arcade-logic.test.mjs
node --test tools/stand-balance.test.mjs tools/stand-runtime.test.mjs
node tools/stand-art.test.mjs
$env:STAND_TEST_URL='https://127.0.0.1:8443'
node tools/stand-server.test.mjs
```

The HTTPS browser integration uses explicit endpoint fixtures to exercise the
real engine result callback, independent browser contexts, phone/EN/ZH UI,
network failure and retry. It is integration evidence, not a human playthrough
or new balance evidence. Its browser context ignores certificate errors;
separately verify the actual certificate chain and hostname with the public CA.
It emits the exact test UUIDs in `tools/shots/intranet/verification.json`.
After service-restart and backup checks, remove **only** those verification
records administratively by exact UUID, never clear the leaderboard.
