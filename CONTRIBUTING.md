# Contributing

Use Node 22 or 24, clone the repository, and run `npm ci`.

```sh
npm run dev          # Interactive playground
npm run test:watch   # Core and React tests
npm run check        # Formatting, types, tests, production builds
npx playwright install chromium
npm run test:e2e     # Browser contracts
npm run test:package # Packed imports, React 18/19, SSR, and declaration compatibility
```

Before a pull request, run checks relevant to your changes. CI is manual-only: maintainers can run the **Check** workflow when needed. No workflow runs on push or pull request.

The SvelteKit site lives in `site/` and uses the released package. Install its dependencies with `npm --prefix site ci`, then use `npm run site:dev`, `npm run site:check`, or `npm run site:build`. These commands regenerate website content from `docs/`. Edit the original Markdown, not `site/src/lib/generated/`. See [the site README](site/README.md) for the standalone workflow.

Keep core framework-independent and dependency-free. Prefer behavior-level tests with controlled promises and fake timers. If you add an adapter, cover cancellation, errors, supersession, and actual completion rather than assuming a router returns a completion promise. Keep optimistic reducers pure and examples accessible.

Please discuss significant new API surface in an issue before implementing it. Small fixes and documentation improvements can go straight to a pull request. Contributions are licensed under MIT.
