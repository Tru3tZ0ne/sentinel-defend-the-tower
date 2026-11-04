# Intranet deployment verification — 2026-11-04

Deployment `intranet-v1` is based on matte-arena game commit `95576af`.

- Backend: five Python integration groups passed, covering persistent SQLite,
  service-object recreation, independent HTTP clients, concurrent UUID retries,
  conflicting submissions, validation, history beyond the top 50, full-table
  rank, ties, safe static routing, runtime config, and backup restore.
- Shared-board, arcade, combat and runtime: 63 tests passed. Existing seeded
  balance checks were unchanged. These are automated policy checks, not new
  human event playtesting.
- Existing equipment/browser suite passed: desktop and phone EN/ZH, product
  upgrades, Agent workflow, ten-second choice behavior, victory/defeat results,
  replay, showroom, and resource/console checks.
- Deployed HTTPS integration passed: the real engine terminal callback saved a
  result; a separate clean browser context saw it without a local score record;
  a forged local record did not appear; phone Chinese labels fit; API failure
  displayed an explicit unsaved state; retry reused the UUID; duplicate retry
  produced one record. These terminal-state setups were explicit fixtures.
- The actual CA chain and loopback hostname were verified with Python's default
  SSL verification using the downloaded public CA. The server itself also
  verified HTTPS with curl and its CA. The separate browser fixture used
  `ignoreHTTPSErrors` and is not presented as certificate-trust evidence.
- Three exact verification UUIDs survived a real `systemctl restart sentinel`.
  A systemd-created backup restored to a temporary database with identical
  records and a successful integrity check. Only those three verification UUIDs
  were subsequently removed; the current leaderboard starts clean.
- The game service and daily backup timer are enabled. The server certificate
  is valid until 2027-11-04; renewal is required before then. Private CA signing
  material remains root-only on the VM; only the public CA was downloaded.
- Existing address, connected-only route and firewall configuration were
  preserved. HTTPS listens on 443. Current-workstation access uses a loopback
  SSH tunnel; internal clients require their existing private-network reachability.

No rendering or gameplay implementation was changed. No claim is made about
new hardware FPS measurements, Internet-scale capacity, authenticated scores,
off-host disaster recovery, or browser history migration. Current event scores
are shared server records; historical browser-only scores remain on their
original devices. Operator access details are kept outside the repository.
