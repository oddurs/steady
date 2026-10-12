import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('selection acknowledges immediately and old content stays until commit', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByTestId('intent')).toHaveText('Settings');
  await expect(page.getByTestId('committed')).toHaveText('Overview');
  await expect(
    page.getByRole('heading', { name: 'A little room to think.' }),
  ).toBeVisible();
  await expect(page.getByTestId('committed')).toHaveText('Settings');
  await expect(
    page.getByRole('heading', { name: 'Make yourself at home.' }),
  ).toBeVisible();
});

test('a failed navigation recovers and retry succeeds', async ({ page }) => {
  await page.getByRole('button', { name: 'Fail next request' }).click();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t open Activity');
  await expect(page.getByTestId('intent')).toHaveText('Overview');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByTestId('committed')).toHaveText('Activity');
});

test('an optimistic bookmark rolls back after failure', async ({ page }) => {
  await page.getByRole('button', { name: 'Fail next request' }).click();
  await page
    .getByRole('button', { name: 'Bookmark project', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Remove bookmark', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('alert')).toContainText(
    'Your bookmark was restored',
  );
  await expect(
    page.getByRole('button', { name: 'Bookmark project', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
});

test('the latest search wins and older results stay useful while pending', async ({
  page,
}) => {
  const input = page.getByRole('textbox', { name: 'Search projects' });
  await input.fill('design');
  await input.fill('navigation');
  await expect(
    page.getByRole('list', { name: 'Search results' }),
  ).toContainText('Design tokens');
  await expect(
    page.getByRole('list', { name: 'Search results' }).getByRole('listitem'),
  ).toHaveCount(1);
  await expect(
    page.getByRole('list', { name: 'Search results' }),
  ).toContainText('Navigation research');
});

test('an uncooperative older request cannot overwrite the latest result', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Run the race' }).click();
  await expect(page.getByTestId('race-result')).toHaveText('Latest request');
  // Wait beyond the slow transport to prove it cannot commit a stale response.
  await page.waitForTimeout(1400);
  await expect(page.getByTestId('race-result')).toHaveText('Latest request');
});

test('renders without horizontal overflow or runtime errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Interfaces that hold up.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
