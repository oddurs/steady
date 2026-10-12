import { expect, test } from '@playwright/test';

test('demo acknowledges intent, keeps content, and recovers from failure', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const demo = page.getByTestId('navigation-demo');
  await expect(demo.getByRole('button', { name: 'Projects' })).toBeEnabled();
  await page.screenshot({
    path: `/tmp/steady-site-${info.project.name}.png`,
    fullPage: true,
  });
  await demo.getByRole('button', { name: 'Projects' }).click();
  await expect(demo.getByTestId('selected')).toHaveText('Projects');
  await expect(demo.getByTestId('current')).toHaveText('Overview');
  await demo.getByRole('button', { name: 'Notes', exact: false }).click();
  await expect(demo.getByTestId('selected')).toHaveText('Notes');
  await expect(demo.getByTestId('current')).toHaveText('Notes');
  await expect(demo.getByRole('heading')).toHaveText(
    'The details make the difference.',
  );
  await demo
    .getByRole('button', { name: 'Make the next request fail' })
    .click();
  await demo.getByRole('button', { name: 'Projects' }).click();
  await expect(demo.getByRole('alert')).toBeVisible();
  await expect(demo.getByTestId('selected')).toHaveText('Notes');
  await expect(demo.getByTestId('current')).toHaveText('Notes');
  await demo.getByRole('button', { name: 'Try again' }).click();
  await expect(demo.getByTestId('current')).toHaveText('Projects');
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('docs navigate, deep-link, and fit a small viewport', async ({
  page,
}, info) => {
  await page.goto('/docs/getting-started/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Getting started',
  );
  await page.getByRole('button', { name: 'Documentation' }).click();
  await page
    .getByRole('navigation', { name: 'Documentation', exact: true })
    .getByRole('link', { name: 'Navigation', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Navigation',
  );
  await page.getByText('On this page', { exact: true }).click();
  await page
    .getByRole('navigation', { name: 'On this page' })
    .getByRole('link', { name: 'Prefetch options and results' })
    .click();
  await expect(page).toHaveURL(/#prefetch-options-and-results$/);
  await page.screenshot({
    path: `/tmp/steady-docs-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('install command copies the real release URL', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Copy install the release' }).click();
  await expect(
    page.getByRole('button', { name: 'Copy install the release' }),
  ).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'npm install https://github.com/oddurs/steady/releases/download/v0.2.0/oddurs-steady-0.2.0.tgz',
  );
});

test('all docs are readable and linked without JavaScript', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    ...(info.project.use.viewport
      ? { viewport: info.project.use.viewport }
      : {}),
  });
  const page = await context.newPage();
  const pages = [
    'getting-started',
    'tasks',
    'navigation',
    'mutations',
    'performance',
    'react',
    'svelte',
    'integrations',
    'design',
  ];
  for (const slug of pages) {
    const response = await page.goto(`http://127.0.0.1:4180/docs/${slug}/`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.prose')).not.toBeEmpty();
    await expect(
      page.getByRole('navigation', { name: 'Documentation', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await context.close();
});
