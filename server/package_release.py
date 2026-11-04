"""Package public game files and server code without Git, credentials or node_modules."""
import argparse
import tarfile
from pathlib import Path


def package(destination):
    root = Path(__file__).resolve().parents[1]
    with tarfile.open(destination, 'w:gz') as archive:
        for directory in ('src', 'assets', 'vendor'):
            for file in sorted((root/directory).rglob('*')):
                if file.is_file() and not any(p.startswith('.') for p in file.relative_to(root).parts):
                    archive.add(file, arcname='game/'+file.relative_to(root).as_posix(), recursive=False)
        for file in sorted(root.glob('*.html')) + [root/'deployment-config.js']:
            archive.add(file, arcname='game/'+file.name, recursive=False)
        for file in sorted((root/'server').iterdir()):
            if file.is_file() and file.suffix in ('.py', '.sh', '.service', '.timer'):
                archive.add(file, arcname='server/'+file.name, recursive=False)
    print(Path(destination).resolve())


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('destination')
    package(parser.parse_args().destination)
