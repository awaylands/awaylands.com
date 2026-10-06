# Historical CMS snapshots

The August 4 CMS exports are preserved in the private recovery bundle:
https://github.com/awaylands/awaylands-backups/releases/tag/backup-2026-10-06

To extract an original export after restoring the bundle:

```sh
git show 4a52df2:backups/2026-08-04/awaylands-cms-production.zip > awaylands-cms-production.zip
git show 4a52df2:backups/2026-08-04/awaylands-cms-production-clean.zip > awaylands-cms-production-clean.zip
```

The first snapshot predates the August CMS cleanup. The second includes schema
version 249 and the repaired Story slugs and Home & Garden mappings. These are
historical recovery files, not current production inputs. Their original
metadata and checksums remain in the same commit's README.
