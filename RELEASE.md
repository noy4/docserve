# Release

## Quick release (script)

`scripts/release.sh <cli|desktop|both> <major|minor|patch|X.Y.Z>` — bumps, tags, pushes, and watches CI. On failure, see the notes below.

## Desktop app

1. Bump `version` in `desktop/package.json` — the tray update notice compares this against the latest release tag, so it is the release number
2. Commit and push `main`
3. Tag and push: `git tag -a vX.Y.Z -m "Docserve X.Y.Z" && git push origin vX.Y.Z` — the `release-desktop` workflow builds the DMGs and publishes the GitHub Release automatically

Notes:

- Forgetting step 1 means existing users never see the "New version available" tray notice
- The build is ad-hoc signed via the `afterPack` hook — without it, macOS on Apple Silicon reports the app as "damaged"

## CLI

1. Bump `version` in `cli/package.json`
2. Commit and push `main`
3. Tag and push: `git tag -a cli-vX.Y.Z -m "@noy4/docserve X.Y.Z" && git push origin cli-vX.Y.Z` — the `publish-cli` workflow publishes to npm automatically (trusted publishing, provenance included)

Desktop and CLI versions are independent. If the publish fails with auth errors, check the Trusted Publisher on npmjs.com (`noy4` / `docserve` / `publish-cli.yml`).
