# Score administration portal

## Operator features

Open `/admin/` on the same HTTPS origin as the game. The standalone, responsive
EN/ZH portal lists every saved victory (50 per page), searches player names,
exports all matching records to CSV or JSON, deletes individual or selected
records, and clears the full leaderboard after the operator types `DELETE ALL`.
CSV includes score dimensions and UTC timestamps, uses a UTF-8 BOM for Excel,
and escapes player-controlled spreadsheet formulas. JSON retains original values.
Export covers all matching records, beyond the current page or public top 50.

The game, visual assets and public submission API are unchanged. The portal
uses Python's standard library and adds no browser framework or package.

## Accounts and sessions

Admin access is disabled until a private config exists. Create or rotate it with:

```sh
sudo python3 /opt/sentinel-server/admin_password.py /etc/sentinel/admin.json --username gameadmin
sudo chown root:sentinel /etc/sentinel/admin.json
sudo chmod 640 /etc/sentinel/admin.json
sudo systemctl restart sentinel
```

Enter a password of at least 16 characters. `--generate` creates a random password
and prints it once. Store delivered passwords separately; never add credentials
or the private config to Git or the public game directory. The config stores a
salted scrypt hash. A custom location is supported through `--admin-config`.

Random session tokens use Secure, HttpOnly, SameSite=Strict cookies. Sessions
expire after 30 minutes idle or eight hours absolute; a restart revokes all
sessions. All POST requests require a same-origin Origin header. Authenticated
mutations also require the session CSRF token. Login attempts and expensive
password checks are bounded. Admin responses are not cached; pages have a
restrictive Content Security Policy.

## Delete recovery and backups

Each deletion stores complete original records, administrator name, action,
timestamp and affected count in the SQLite `admin_audit` table. Auditing and
deletion commit in one transaction: audit failure rolls back deletion. A repeated
delete cannot delete unrelated records. Clearing scores preserves audit history.
There is no public audit endpoint.

The existing daily SQLite backup includes audit history. Before a backend update,
take a consistent snapshot with `systemctl start sentinel-backup.service`.
Backups and the database remain outside release directories.

An operator with server access can restore an audited batch without overwriting
newer attempts. Select the intended audit ID, inspect its metadata privately,
and use a SQLite transaction to `INSERT OR IGNORE` each saved row into the six
`scores` columns (`id,name,score,at,note,details`). Preserve the audit record. For
a full backup restore, follow `INTRANET_DEPLOYMENT.md`; that can discard newer
records and should only be used when necessary.

## Backend deployment and rollback

Deploy `app.py`, `admin_portal.py`, `admin_password.py` and the three files under
`server/admin/` into a new versioned server directory. Copy unchanged backup and
service support files from the active backend. Point `/opt/sentinel-server` at
the new directory and restart `sentinel.service`. Leave `/srv/sentinel/current`,
TLS files and the score DB in place. The release packager includes portal assets.

To roll back, repoint `/opt/sentinel-server` to the previous backend and restart.
The old backend ignores the additive audit table. Do not replace the DB, TLS
certificate or game symlink for a backend rollback.

## Validation (2026-11-18)

`python -m unittest discover -s server -p 'test_*.py'` passed 11 tests covering
existing score behavior, admin authentication, expiry, throttling, CSRF/origin
checks, CSV formula handling, complete and filtered export, pagination, audited
deletion and transaction rollback on audit failure.

A separate disposable HTTPS browser fixture verified login/logout, real cookie
handling, search, pagination, CSV/JSON downloads, individual deletion, batch
selection/cancel, typed full-clear confirmation, EN/ZH and desktop/mobile layouts.
It used its own database. No production scores were deleted during validation.


Deployment verification: the live HTTPS portal accepted the generated account,
exported all five existing records as JSON and CSV, rejected a mutation without
a CSRF token, and revoked the session at logout. The existing five production
scores and the public game remained available; no production deletion was used
for validation. The previous backend and a consistent pre-update database backup
are retained for rollback.
