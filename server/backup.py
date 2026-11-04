"""Create a consistent SQLite backup; keep the newest 30 daily snapshots."""
import argparse
from contextlib import closing
import datetime
import sqlite3
from pathlib import Path


def backup(source, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / ('scores-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.sqlite3')
    with closing(sqlite3.connect('file:' + str(Path(source).resolve()) + '?mode=ro', uri=True)) as src:
        with closing(sqlite3.connect(target)) as dst:
            src.backup(dst)
            if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Backup integrity check failed')
    target.chmod(0o600)
    for stale in sorted(directory.glob('scores-*.sqlite3'), reverse=True)[30:]:
        stale.unlink()
    print(target)
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('directory')
    args = parser.parse_args()
    backup(args.source, args.directory)
