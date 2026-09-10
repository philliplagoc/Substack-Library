# Contributing

Thanks for taking a look. This is a small project and issues or pull requests
are welcome.

## Working on the code

All the code lives in `extension/` (a [WXT](https://wxt.dev) project).

```sh
cd extension
npm install
npm run dev      # load the dev build, live-reloading
npm test         # vitest, run once
npm run compile  # tsc --noEmit, type-check only
npm run build    # production build into extension/.output/
```

Load `extension/.output/chrome-mv3` as an unpacked extension at
`chrome://extensions` with Developer mode on.

There is also `extension/MANUAL-CHECKS.md` for the parts that tests do not
cover (the `src/ui/` layer and the IndexedDB migration).

## Pull requests

- Keep the change focused, and add or update tests for it.
- `npm run compile`, `npm test`, and `npm run build` all need to pass. CI runs
  the same three.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).

## Substack's DOM

The Substack read paths in `extension/src/substack/` match on component-name
prefixes because every class is an unversioned build hash. When one breaks,
re-capture the relevant page, update the fixture in
`extension/src/substack/__fixtures__/`, and adjust the selector. Strip any
personal data from a new capture before committing it.
