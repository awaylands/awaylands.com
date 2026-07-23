# Away Lands production baseline

This directory is the only approved source for publishing `www.awaylands.com`.

Verified baseline:

- Date: 2026-07-22
- Branch: `production-baseline`
- Source commit: `0b4e6700f447e2315872372ca3ceee4502907991`
- JavaScript: `main.91618a6ec51b6585278d.js`
- Stylesheet: `main.40b648f5eb8084bbffbcd7fe991ad825.css`

## Safe publishing workflow

1. Make and test changes in the normal development checkout.
2. Copy only approved files into this production worktree.
3. Update `.production-baseline.json` only after reviewing those exact changes.
4. Commit the approved production state.
5. Run `npm run verify:production`.
6. Run `npm run deploy`.
7. Publish `www.awaylands.com` from TakeShape.
8. Verify the homepage, blog, category, destination, and story pages.

`npm run deploy` refuses to run from another branch, a dirty worktree, the wrong TakeShape target, changed protected files, or unverified compiled assets.

Older versions and the mixed work in progress state are archived under:

`/Users/amyseder/Documents/Codex/Away Lands Archives/2026-07-22-baseline-cleanup`
