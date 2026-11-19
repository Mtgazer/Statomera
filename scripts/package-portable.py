"""Package the locally built Pages artifact without copying the repository."""

import argparse
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("archive", type=Path, help="new ZIP path outside dist-portable")
args = parser.parse_args()

root = Path(__file__).resolve().parents[1] / "dist-portable"
archive_path = args.archive.resolve()
if archive_path.is_relative_to(root) or archive_path.suffix != ".zip":
    parser.error("choose a new .zip path outside dist-portable")

paths = sorted(root.rglob("*"))
if any(path.is_symlink() for path in paths):
    parser.error("portable output contains a symbolic link")
files = [path for path in paths if path.is_file()]
required = {"index.html", "_headers", "third-party-notices.txt"}
root_files = {path.name for path in files if path.parent == root}
if root_files != required:
    parser.error("portable output must contain index.html, _headers and the notices file")
assets = [path for path in files if path.parent != root]
if not assets or any(path.parent != root / "assets" or path.suffix not in {".css", ".js", ".svg"} for path in assets):
    parser.error("unexpected contents in the portable assets directory")

# Dashboard Direct Upload limits, as documented at Phase 8 preparation.
if len(files) > 1_000 or any(path.stat().st_size > 25 * 1024 * 1024 for path in files):
    parser.error("portable output exceeds Cloudflare's dashboard upload limits")

with ZipFile(archive_path, "x", compression=ZIP_STORED) as archive:
    for path in files:
        entry = ZipInfo(path.relative_to(root).as_posix())
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, path.read_bytes())

largest = max(files, key=lambda path: path.stat().st_size)
print(f"{len(files)} files, {sum(path.stat().st_size for path in files):,} uncompressed bytes")
print(f"Largest file: {largest.relative_to(root)} ({largest.stat().st_size:,} bytes)")
