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

The dev, check, and build commands sync `docs/` into `site/src/lib/generated/` first. Keep the generated files committed so this directory also works as a standalone project. To run it standalone, use `npm ci`, `npm run dev`, `npm run check`, and `npm run build` inside this directory. Local development and previews use `/steady/`, matching production.

`site:test` checks the current production build in desktop and mobile Chromium, including recovery in the demo, clipboard installation, navigation, and docs with JavaScript disabled. Run `site:build` first; install Chromium with `npx playwright install chromium` if needed. Browser checks are local and do not trigger CI.

The build writes `build/`, deployed to [GitHub Pages](https://oddurs.github.io/steady/). The **Deploy website** workflow in `.github/workflows/pages.yml` runs only through `workflow_dispatch`; pushes and pull requests do not deploy or run CI. It installs only the site's dependencies, builds the static files, and publishes them.

After checking the site locally and pushing your commit, publish it with:

```sh
gh workflow run pages.yml --ref main
```

The workflow follows [GitHub's Pages deployment setup](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). `paths.base` and SvelteKit's `resolve`/`asset` helpers keep links and assets under the repository path, as described in [SvelteKit's GitHub Pages guidance](https://svelte.dev/docs/kit/adapter-static#GitHub-Pages).

All documentation content is authored in this repository and rendered at build time. Markdown rendering is not intended for untrusted user input. Each page links back to its source file. The site uses system fonts and makes no font downloads.

To update for a new release, update the Steady dependency URL and this package's version, regenerate its lockfile, and run `npm run site:sync` at the repository root. The demo deliberately simulates a 900 ms network delay to make immediate selection and retained content observable.
