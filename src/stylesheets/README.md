# Stylesheet organization

`main.scss` is the single production entry point. It imports reset/fonts,
shared functions and mixins, layout, components, page styles, advertising and
tooltips in that order. Every SCSS file is reachable exactly once.

`_pages.scss` controls page ordering. `_blog.scss` imports `pages/_categories.scss`
at its end: this placement is intentional because category rules override
shared blog rules. Keep the import there. `_categories.scss` replaces the former
`_category-redesign-final.scss` name without moving its cascade position.

Edit the relevant component or page file. Prefer changing an existing rule
over appending another override. Responsive and state rules may intentionally
repeat a selector with different declarations; do not merge them across media
queries or reorder them without rendering comparisons.

Run `npm run lint:css` and `npm run check:styles`. The structural check rejects
missing imports, repeated imports, orphan SCSS files and exact repeated plain
declaration blocks. The compiled CSS must be rebuilt after source edits.

Preserve article `em`/`i` styling, the Mediavine layout and selector contracts,
and the production Film styles. The October 6 deduplication removed 26 repeated
blocks with byte-identical compiled CSS under the same compiler.
