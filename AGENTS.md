# Away Lands writing style

- Never use an em dash in any site copy, documentation, comments, labels, commit messages, or user-facing writing.
- Use a standard hyphen with one space on both sides instead: ` - `.

# Strict change scope

- Change only what Amy explicitly directs.
- Do not make related improvements, cleanup, formatting changes, dependency changes, refactors, fixes, or any other modifications outside the explicit directive.
- If any change beyond the explicit directive seems necessary or advisable, ask Amy first and wait for approval before starting work.

# Publishing locks

- The Film page redesign is local-only. Keep the original Film page live.
- Do not publish the Film redesign unless Amy explicitly asks to publish it.
- Never run `takeshape deploy` directly from this development checkout.
- The only approved production source is `/Users/amyseder/Documents/Codex/Away Lands Production`.
- Before any production upload, run `npm run verify:production` in that production worktree.
- Use `npm run deploy` in the production worktree so the baseline guard runs before upload.

# Mediavine protection

- Preserving Mediavine advertising is an extremely important requirement for every site change.
- Never remove, disable, defer, duplicate, or accidentally scope out the Mediavine script wrapper.
- Preserve the In-Content and Sticky Sidebar selectors and their target elements on story pages.
- Before completing any change to templates, layouts, styles, scripts, page structure, hydration, or deployment behavior, verify that the Mediavine wrapper still loads exactly once and that In-Content and Sticky Sidebar placements remain discoverable.
- Treat a Mediavine regression as a release blocker.
- Never load or display Mediavine ads on `/film`, `/still`, or any of their subpages.
