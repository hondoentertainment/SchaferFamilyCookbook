import { test } from '@playwright/test';
import { loginAs } from './fixtures';

test('probe skeleton timeline', async ({ page }) => {
  test.setTimeout(150000);
  const events: string[] = [];
  const t0 = Date.now();
  const stamp = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;
  let writeReqs = 0, listenReqs = 0;
  page.on('request', (r) => {
    if (r.url().includes(':8080')) {
      if (r.url().includes('/Write/')) writeReqs++;
      if (r.url().includes('/Listen/')) listenReqs++;
    }
  });
  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('subscribeRecipes error') || t.includes('transport errored') || t.includes('PERMISSION_DENIED')) {
      events.push(`${stamp()} [console] ${t.slice(0, 130)}`);
    }
  });
  await loginAs(page, 'Kyle');
  events.push(`${stamp()} login done; resetting counters`);
  writeReqs = 0; listenReqs = 0;
  await page.reload();
  events.push(`${stamp()} reload issued`);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(4000);
    const skel = await page.evaluate(() => !!document.querySelector('[aria-label="Loading content"]'));
    events.push(`${stamp()} skeleton=${skel} writes=${writeReqs} listens=${listenReqs}`);
    if (!skel && i > 1) break;
  }
  console.log('PROBE3:\n' + events.join('\n'));
});
