# Away Lands post publisher

Run with Node 24 using `npm run publisher`, then open http://127.0.0.1:5058.

Save the post in TakeShape before opening Publish This Post. The Chrome shortcut opens this local publisher and disables itself while the native Save button indicates unsaved changes. The publisher also works by pasting a production Story editor URL.

Quick publication is for existing enabled posts whose title, slug, cover, preview, categories, destination, date, and importance have not changed. It renders one article and patches its search entry, title-index record and sitemap date. Existing locally known legacy URLs with the same canonical link receive the same updated article. Photo-count changes on destination-associated posts require Publish Site, because destination pages display those counts.

New posts and changes to listing metadata use the existing full-site publication path. The interface explains this before publication. It does not promise selective dependent-page regeneration yet.

All uploads run through `npm run deploy -- --post STORY_ID`, use the approved production checkout and run the production baseline verifier. Test with `--dry-run` appended. The dry run generates and validates output, reads existing hosting objects, and writes no remote objects.

The service binds only to 127.0.0.1:5058. It rejects unexpected Host and Origin headers, requires a per-process token and JSON for write requests, and accepts only saved production Story IDs. Hosting credentials remain in the local Node process. No credential or publishing permission is added to the Chrome extension.

Conditional hosting writes detect concurrent object changes. Backups and results are retained privately under `.post-publisher/`. Partial upload failures restore previous objects conditionally; if another publisher changed a file, recovery stops rather than overwrite that work. A public-cache delay is reported as uploaded, not verified live. Do not start a TakeShape full-site publish while a local quick publish is running.

The fast publisher never uploads templates or changes the source bundle stored by TakeShape. Later full publishes continue to use CMS content and the normal approved templates.
