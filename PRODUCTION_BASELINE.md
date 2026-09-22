# Away Lands production baseline

This directory is the only approved source for publishing `www.awaylands.com`.

The live deploy inputs are `src/templates/` and `static/`. The `build/`
folder is generated output for local previews; it is not the direct live
deployment source. Production verification blocks if these folder assignments
drift.

Verified baseline:

- Date: 2026-09-21
- Branch: `production-baseline`
- Source commit: `cb290b7fabda468619d56e77f29f0571c794d262`
- JavaScript: `main.54409b56f890e94886c0.js`
- Stylesheet: `main.cbf15781b62a284dad14.css`
- TakeShape schema: version `249`

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

## Mediavine protection reminder

Do not move, rename, duplicate, remove, defer, or restyle the Mediavine wrapper,
the story content selector, or either sidebar target without reviewing the
Mediavine documentation and updating the production guard. The ATF target must
remain first in the 300px desktop sidebar. The BTF target must remain last.
Run `npm run verify:production` before every publish. A failed Mediavine check
is a release blocker.

The modern Webpack build is reproducible from the locked dependency tree. Build and test source changes in the development checkout, then record reviewed filenames and SHA-256 hashes after visual verification.

Older versions and the mixed work in progress state are archived under:

`/Users/amyseder/Documents/Codex/Away Lands Archives/2026-07-22-baseline-cleanup`
