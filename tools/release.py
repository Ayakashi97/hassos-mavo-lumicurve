"""Prepare a release: python3 tools/release.py 0.8.3 [--dry-run]

Run on a clean main. It checks that [Unreleased] in CHANGELOG.md has content, turns it into the new version with today's date, opens a fresh [Unreleased],
updates the compare links, writes the version into the card header and `manifest.json` and the `?v=` examples in README/INSTALL-HA, runs the tests, commits "Release vX" and tags vX.
It does not push: the last line printed is the push command. Pushing the tag makes GitHub publish the release (.github/workflows/release.yml)."""
import datetime, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO = "https://github.com/Ayakashi97/hassos-mavo-lumicurve"
args = [a for a in sys.argv[1:] if not a.startswith("--")]
dry = "--dry-run" in sys.argv
if len(args) != 1 or not re.fullmatch(r"\d+\.\d+\.\d+", args[0]):
    sys.exit(__doc__)
ver = args[0]


def sh(*cmd, check=True):
    return subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, check=check).stdout.strip()


if sh("git", "status", "--porcelain"):
    sys.exit("working tree is not clean: commit or stash first")
if sh("git", "tag", "--list", f"v{ver}"):
    sys.exit(f"tag v{ver} already exists")
prev = sh("git", "describe", "--tags", "--abbrev=0")

log = (ROOT / "CHANGELOG.md").read_text()
m = re.search(r"## \[Unreleased\]\n(.*?)(?=\n## \[)", log, re.S)
if not m or not re.search(r"^- ", m[1], re.M):
    sys.exit("CHANGELOG.md has no entries under [Unreleased]")
today = datetime.date.today().isoformat()
log = log.replace("## [Unreleased]\n", f"## [Unreleased]\n\n## [{ver}] - {today}\n", 1)
log = re.sub(r"\[Unreleased\]: .*", f"[Unreleased]: {REPO}/compare/v{ver}...HEAD\n[{ver}]: {REPO}/compare/{prev}...v{ver}", log, count=1)

card = ROOT / "custom_components" / "mavo_lumicurve" / "www" / "mavo-lumicurve-card.js"
card_new = re.sub(r"(mavo-lumicurve-card · v)\d+\.\d+\.\d+", rf"\g<1>{ver}", card.read_text(), count=1)
changes = {ROOT / "CHANGELOG.md": log, card: card_new}
man = ROOT / "custom_components" / "mavo_lumicurve" / "manifest.json"
changes[man] = re.sub(r'("version": ")[^"]+', rf"\g<1>{ver}", man.read_text(), count=1)
for doc in ("README.md", "docs/INSTALL-HA.md"):
    p = ROOT / doc
    changes[p] = re.sub(r"\?v=\d+\.\d+\.\d+", f"?v={ver}", p.read_text())

print(f"release v{ver} (previous {prev}), date {today}")
if dry:
    print("dry run: nothing written")
    sys.exit(0)
for p, text in changes.items():
    p.write_text(text)
sh("python3", "-m", "unittest", "discover", "-s", "tests")
sh("node", "--check", "custom_components/mavo_lumicurve/www/mavo-lumicurve-card.js")
sh("git", "add", "-A")
sh("git", "commit", "-q", "-m", f"Release v{ver}")
sh("git", "tag", "-a", f"v{ver}", "-m", f"v{ver}")
print(f"done. Publish with:  git push origin main v{ver}")
