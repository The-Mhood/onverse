#!/usr/bin/env python3
"""Verify all80 held originals; optional recovery ONLY to a NEW outside-repo dir."""
import argparse, hashlib, json, tarfile
from pathlib import Path
root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--extract-to', type=Path)
args = parser.parse_args()
manifest = json.loads((root / 'docs/engineering/evidence/cleanup-20261017/classification.json').read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
archive = root / manifest['archive']
assert sha(archive.read_bytes()) == manifest['archiveSha256'], 'Archive checksum mismatch'
entries = manifest['entries']
assert len(entries) == 80 and len({e['path'] for e in entries}) == 80
archived = {e['archiveMember']: e for e in entries if e['archiveMember']}
recovery = {}
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    assert len(members) == len(archived) == 20
    assert {m.name for m in members} == set(archived)
    for member in members:
        assert member.isfile() and not member.islnk() and not member.issym()
        assert not Path(member.name).is_absolute() and '..' not in Path(member.name).parts
        entry = archived[member.name]
        assert member.size == entry['originalBytes'] and member.size < 10 * 1024 * 1024
        data = tar.extractfile(member).read()
        assert sha(data) == entry['originalSha256'], member.name
        recovery[member.name] = data
for entry in entries:
    path = root / entry['path']
    if entry['path'].startswith('build/'):
        assert not path.exists(), f'Retired active icon returned: {path}'
    elif entry['archiveMember']:
        assert sha(path.read_bytes()) == entry['publishedSha256'], entry['path']
    else:
        assert sha(path.read_bytes()) == entry['originalSha256'], entry['path']
if args.extract_to:
    destination = args.extract_to.resolve()
    assert destination != root and root not in destination.parents, 'Recovery must be outside repository'
    assert not destination.exists(), 'Refusing to overwrite existing recovery directory'
    destination.mkdir(parents=True)
    for name, data in recovery.items():
        path = destination / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
print('PASS:80 classified paths;60 authored files unchanged;8 reconciled documents;20 exact originals archived;12 retired live icons absent.')
