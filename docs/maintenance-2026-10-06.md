# Maintenance record - October 6, 2026

## Recovery

- Current source: https://github.com/awaylands/awaylands.com/tree/production-baseline
- Complete pre-cleanup recovery: https://github.com/awaylands/awaylands-backups/releases/tag/backup-2026-10-06
- Pre-cleanup production commit: `4a52df2`
- Archived development including the italic fix: `79243b6`
- Recovery bundle SHA-256: `2bd00250f0371aa0b4e8efcb687347e7f771a1b62fa91017587d9747beec84c6`

The private bundle preserves all 84 Git refs present when it was created,
including branches, tags, and archived unpublished Film work. Verify with
`git bundle verify awaylands-all-branches-2026-10-06.bundle`, then recover with
`git clone awaylands-all-branches-2026-10-06.bundle awaylands-recovered`.
Ignored local credentials and generated build artifacts are not part of Git.

## Changes

- Backed up the 14 previously unpushed production fixes.
- Updated all direct dependencies to registry latest releases as checked today,
  plus compatible transitive updates. Pinned exact versions and Node/npm versions.
- Adapted Babel 8 configuration and Shuffle 7 imports to their current interfaces.
- Removed 26 repeated stylesheet declaration blocks. Compiled CSS was identical
  before/after that cleanup under the same updated compiler.
- Renamed the category stylesheet while preserving its import position.
- Expanded lint coverage to backend scripts, extension scripts, and tool CSS;
  removed unused code and unused exception variables identified by these checks.
- Added stylesheet structure checks and GitHub checks for lint, tests and builds.
- Removed old CMS ZIP exports from the active checkout. Their contents and
  history remain recoverable through the private bundle and prior Git commits.
- Documented the active production source, archived design work and local tools.

## Dependency audit limitation

The initial npm audit reported 13 findings, including one critical finding.
After upgrades there are no reported runtime dependency vulnerabilities and no
critical findings. Nine high findings remain in the development dependency
tree, all tracing to `braces` through watch/glob/lint tools.

The latest `braces` release is still 3.0.3 and is affected by
https://github.com/advisories/GHSA-vfj7-8cjw-p6xm . There was no patched release
available at the audit time. Arbitrary dependency downgrades were not applied.
These tools process the repository's local patterns; they are not shipped in
the browser bundle. Recheck the advisory when upstream publishes a fix.

CI blocks high runtime findings and critical findings across the full tree,
while displaying the known development findings. A passing CI result therefore
does not mean the development dependency tree has zero advisories.

No CMS data, CMS schema, hosting account or unpublished Film design was changed.

## Validation before promotion

- Fresh `npm ci` installation passed with the documented Node/npm versions.
- All direct packages were at registry latest; `npm outdated` returned no entries.
- Expanded lint completed with zero errors and zero warnings.
- All 52 stylesheet imports and the duplicate-block check passed.
- All seven publisher tests passed; the production asset build passed.
- Eight representative page types at desktop and mobile widths had matching
  computed styles and geometry and no JavaScript page errors. The gallery
  initialized and the mobile menu opened and closed successfully.
- Browser comparisons used the same saved production HTML and local assets,
  blocked external services, and fixed random product selection for consistency.
  Live release and advertising verification is performed separately by deploy.

The production generation passed. Approximately 340 MB of obsolete ignored
HTML and compiled assets were moved to the dated local archive outside the
production checkout. Fonts and localized source images were retained. A stale
Git registration for an already-missing temporary checkout was pruned.
