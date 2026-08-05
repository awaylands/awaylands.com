# Away Lands production recovery snapshot — 2026-08-04

This directory preserves the TakeShape production project at the same approved
state as the `production-baseline` source branch on 2026-08-04.

## CMS project export

- Archive: `awaylands-cms-production.zip`
- Contents: TakeShape schema, project pattern, and 18,440 production content records
- Export mode: full project export with data
- Credentials: none included (the archive contains only `pattern.yaml`,
  `schema.json`, and `data.jsonl`)
- SHA-256: `3162af3453dfb201eb6b0164cb859587c8d6cae137445628ee521ff4dac07e15`

The archive was exported before removing unused legacy Category editor fields,
so it is a complete rollback point for both the backend schema and its content.

## Post-clean production export

- Archive: `awaylands-cms-production-clean.zip`
- Contents: TakeShape schema version 249, project pattern, and 18,440 production
  content records
- Export mode: full project export with data, after the editor cleanup and
  guarded production deployment
- Credentials: none included (the archive contains only `pattern.yaml`,
  `schema.json`, and `data.jsonl`)
- SHA-256: `9f0f26c14dd4e0a3a03e8dd5908baabc16d006e2640212a49fcae535238d06c7`

This refreshed post-clean archive also includes the approved repair of 322
previously blank Story slug fields and the Home & Garden category mappings to
Pets and Outdoor Living.

Use the first archive to roll back the schema cleanup. Use the post-clean
archive to restore the exact backend state verified and deployed on 2026-08-04.
