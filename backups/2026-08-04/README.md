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

