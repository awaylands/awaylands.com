# Away Lands production baseline

This directory is the only approved source for publishing `www.awaylands.com`.

Verified baseline:

- Date: 2026-07-22
- Branch: `production-baseline`
- Source commit: `0b4e6700f447e2315872372ca3ceee4502907991`
- JavaScript: `main.91618a6ec51b6585278d.js`
- Stylesheet: `main.861bc19b5b0eb8f5e968aa0e52d93cbf.css`
- TakeShape schema: version `212`

## Safe publishing workflow

1. Make and test changes in the normal development checkout.
2. Copy only approved files into this production worktree.
3. Update `.production-baseline.json` only after reviewing those exact changes.
4. Commit the approved production state.
5. Run `npm run verify:production`.
6. Run `npm run deploy`.
7. Publish `www.awaylands.com` from TakeShape.
8. Verify the homepage, blog, category, destination, and story pages.

`npm run deploy` refuses to run from another branch, a commit outside the verified baseline history, a dirty worktree, the wrong TakeShape target, an exposed credential file, a stale backend schema snapshot, changed protected files, or compiled assets whose filenames or contents differ from the verified live files.

The legacy Webpack build is not byte-reproducible with the current installed dependency tree. Build and test source changes in the development checkout. Only copy reviewed assets into this production worktree, then record their filenames and SHA-256 hashes after live visual verification.

Older versions and the mixed work in progress state are archived under:

`/Users/amyseder/Documents/Codex/Away Lands Archives/2026-07-22-baseline-cleanup`
