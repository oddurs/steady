# Steady website

A small Svelte 5 / SvelteKit 3 site: project introduction, an interactive navigation demo, and nine documentation pages. Pages are rendered to static HTML, with no server or database required. The demo uses the actual released Steady core.

Use Node 24. From the repository root:

```sh
npm --prefix site ci
npm run site:dev
npm run site:check
npm run site:build
npm run site:test
```

The root commands sync `docs/` into `site/src/lib/generated/` first. Keep the generated files committed so this directory also works as a standalone project. To run it standalone, use `npm ci`, `npm run dev`, `npm run check`, and `npm run build` inside this directory.

`site:test` checks the current production build in desktop and mobile Chromium, including recovery in the demo, clipboard installation, navigation, and docs with JavaScript disabled. Run `site:build` first; install Chromium with `npx playwright install chromium` if needed. Browser checks are local and do not trigger CI.

The build writes `build/`. Host that directory on a static host with directory index support. The tracked `.openai/hosting.json` configures Sites hosting. Source is also kept in the public Steady repository. CI remains manual-only.

All documentation content is authored in this repository and rendered at build time. Markdown rendering is not intended for untrusted user input. Each page links back to its source file. The site ships self-hosted Latin subsets of DM Sans and Instrument Serif; their SIL Open Font License files are in `static/fonts/`.

To update for a new release, update the Steady dependency URL and this package's version, regenerate its lockfile, and run `npm run site:sync` at the repository root. The demo deliberately simulates a 900 ms network delay to make immediate selection and retained content observable.
