# Releasing

A release is a git tag `vX.Y.Z`. Pushing it makes GitHub publish a release whose notes are the matching section of `CHANGELOG.md` and whose attached file is `custom_components/mavo_lumicurve/www/mavo-lumicurve-card.js`.
The Marketplace then shows a real version, release notes and update notices (without a release it tracks the newest commit).

## Versioning

Semantic Versioning. While below 1.0: a **breaking** change raises the minor number (0.8.x to 0.9.0), everything else the patch number.
Breaking means a dashboard needs a change: a renamed card type, option, theme variable or storage key, or a removed option.
New options with a default, fixes, and docs are not breaking.

## Changelog

`CHANGELOG.md` uses [Keep a Changelog](https://keepachangelog.com/en/1.1.0/): sections `Added`, `Changed`, `Fixed`, `Removed` under `## [Unreleased]` while you work.
Write for people who use the card, one line per change, and mark breaking changes with **Breaking:** plus what to do. Add the entry in the same commit as the change.

## Making a release

1. Make sure `CHANGELOG.md` has entries under `[Unreleased]` and the tests pass (`python3 tests/test_parse.py`).
2. `python3 tools/release.py 0.8.3` (add `--dry-run` to only see what it would do). On a clean `main` it:
   turns `[Unreleased]` into `[0.8.3] - <today>`, opens a new `[Unreleased]`, fixes the compare links, writes the version into the card header and the `?v=` examples in `README.md` and `docs/INSTALL-HA.md`,
   runs the tests, commits "Release v0.8.3" and tags `v0.8.3`.
3. `git push origin main v0.8.3`. The workflow `.github/workflows/release.yml` tests again, extracts the notes and creates the release.
4. In Home Assistant: Settings → Marketplace → the card → **Refresh information**, then **Update**. Hard refresh the browser.

A release for a tag that already exists (for example `v0.8.2`): GitHub → Actions → Release → Run workflow → enter the tag. It needs a `## [0.8.2]` section in `CHANGELOG.md`.

## One-time GitHub settings

- Repository description and topics (`home-assistant`, `lovelace`, `dashboard`), issues enabled: the Marketplace checks for them.
- After the first release exists you can add `"hide_default_branch": true` to `hacs.json`, so only released versions are offered, not the newest commit.
- A licence.

## Version places

The script keeps these in sync: the header comment of `custom_components/mavo_lumicurve/www/mavo-lumicurve-card.js`, the `?v=` in the resource examples (`README.md`, `docs/INSTALL-HA.md`), and the headings and links in `CHANGELOG.md`. `hacs.json` has no version.
