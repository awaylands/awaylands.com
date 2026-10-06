# Away Lands

TakeShape website for [awaylands.com](https://www.awaylands.com).
The `production-baseline` branch is the current, verified website source.

## Project map

| Location | Purpose |
| --- | --- |
| `src/templates/` | Page layouts, GraphQL queries, and feeds |
| `src/stylesheets/` | Shared and page styles; entry point `main.scss` |
| `src/javascripts/` | Browser behavior and Vue components |
| `src/images/` | Source images |
| `static/assets/fonts/` | Source fonts and their supplied licenses |
| `scripts/` | Local editorial tools, build checks, and guarded publishing |
| `tools/takeshape-skim-extension/` | Chrome extension source |
| `build/` | Generated output, ignored by Git |
| `publish-static/` | Generated upload assets and redirects, ignored by Git |
| `_takeshape-schema-export/` | Pinned schema snapshots used by production checks |

Do not edit generated CSS, JavaScript, or HTML. Edit `src/`, then build.

## Setup and checks

Use Node 24.19.0 and npm 12.2.0. The version files and package engines enforce
the supported toolchain; old global npm installations cannot maintain this lockfile.

```sh
nvm install
nvm use
npm install --global npm@12.2.0
npm ci
npm run check
npm run build
```

`npm run check` checks application, backend-tool and extension JavaScript, all
external CSS/SCSS, stylesheet imports and repeated declaration blocks, and the
publisher tests. GitHub runs these checks and the asset build on pushes and PRs.
The CI job cannot deploy or change CMS content and needs no hosting credentials.

`npm run serve:stories`, `npm run story:editor`, `npm run story:importer`, and
`npm run still:grid` launch the local tools. Stop a tool with Ctrl-C when finished.
CMS access uses private local configuration and is never included in a code backup.

## Production publishing

Only `/Users/amyseder/Documents/Codex/Away Lands Production` is approved for
production uploads. Read [PRODUCTION_BASELINE.md](PRODUCTION_BASELINE.md) before
changing production. Commit reviewed changes, run `npm run verify:production`,
and use `npm run deploy`; never call the TakeShape deploy command directly.
Update pinned hashes only after reviewing and testing the corresponding changes.

The original Film page remains live. Unpublished design work is preserved on
`archive/development-2026-09-24` and in the private recovery snapshot. Do not merge
that archived branch wholesale into production.

Advertising protections are release blockers: each article must retain its
single Mediavine wrapper, body selector and ordered sidebar targets. Film and
Still pages remain ad-free. Quick single-post publishing still requires a real
hosting connection; routine publishing uses TakeShape's existing connection.

## Maintenance and recovery

Direct package versions are exact and the lockfile is committed. Use `npm ci`
for reproducible installs. Review `npm outdated` and `npm audit` before upgrades;
test major upgrades before updating production asset hashes. Do not use
`npm audit fix --force` to accept arbitrary downgrades or incompatible changes.

See [the October 6 maintenance record](docs/maintenance-2026-10-06.md) for the
checks, remaining upstream advisory, and recovery links. Historical CMS exports
are kept in the private backup rather than copied into every active checkout.
