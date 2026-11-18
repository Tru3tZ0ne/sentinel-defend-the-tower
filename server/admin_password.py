"""Create or rotate an admin password hash; restart sentinel after changing it."""
import argparse
import getpass
import json
import os
from pathlib import Path
import secrets
from admin_portal import password_config


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('destination', help='Private config path outside the public game directory')
    p.add_argument('--username', default='gameadmin')
    p.add_argument('--generate', action='store_true', help='Print a newly generated password once')
    args = p.parse_args()
    password = secrets.token_urlsafe(24) if args.generate else getpass.getpass('New password (at least 16 characters): ')
    if not args.generate and password != getpass.getpass('Confirm new password: '):
        raise SystemExit('Passwords do not match')
    config = password_config(args.username, password)
    path = Path(args.destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.next')
    fd = os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(config, f)
        f.write('\n')
    os.replace(temporary, path)
    print('Username:', args.username)
    if args.generate:
        print('Password:', password)
    print('Saved password hash:', path)
    print('Grant the sentinel service read access (root:sentinel, 0640), then restart sentinel.')


if __name__ == '__main__':
    main()
