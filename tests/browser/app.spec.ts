import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { decodeSnapshot } from '../../src/domain/engine';
import { validateBank } from '../../src/domain/question';

const bank = validateBank(JSON.parse(readFileSync('src/generated/questions.json', 'utf8')));
const key = 'grundwissen.progress';

async function snapshot(page: Page) {
  const raw = await page.evaluate(storageKey => localStorage.getItem(storageKey), key);
  if (!raw) throw new Error('Browser profile snapshot was not saved');
  return decodeSnapshot(raw);
}

async function questionFor(page: Page) {
  const state = await snapshot(page);
  const question = bank.find(question => question.id === state.currentAttempt?.questionId);
  if (!question) throw new Error('Current question is missing from bank');
  return question;
}

async function choose(page: Page, correct: boolean) {
  const question = await questionFor(page);
  const choice = question.choices.find(choice =>
    correct ? choice.id === question.correctChoiceId : choice.id !== question.correctChoiceId);
  if (!choice) throw new Error('Expected answer choice is missing');
  await page.getByRole('radio', { name: choice.text, exact: true }).check();
  await expect.poll(async () => (await snapshot(page)).currentAttempt?.selectedChoiceId).toBe(choice.id);
  await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).currentAttempt?.phase).toBe('answered');
  return question;
}

async function setRange(page: Page, start: number, end: number) {
  await page.getByLabel('Von Jahr', { exact: true }).fill(String(start));
  await page.getByLabel('Bis Jahr', { exact: true }).fill(String(end));
  await page.getByRole('button', { name: 'Filter anwenden', exact: true }).click();
}

test('actual answer, contextual reveal, reload and new attempt preserve atomic scoring', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Antwort prüfen', exact: true })).toBeDisabled();
  const original = await snapshot(page);
  const question = await choose(page, true);
  await expect(page.getByRole('heading', { name: 'Richtig beantwortet.', exact: true })).toBeVisible();
  await expect(page.getByRole('radio').first()).toBeDisabled();
  expect((await snapshot(page)).lifetimeXp).toBe(10);
  await page.getByRole('button', { name: 'Fakt & Einordnung ansehen', exact: true }).click();
  await expect(page.getByText(question.fact, { exact: true })).toBeVisible();
  await expect(page.locator('.history-context')).toContainText(question.explanation.split('[')[0].trim());
  await expect(page.locator('.history-context')).not.toContainText('](');
  await expect(page.getByRole('link', { name: `${question.sources[0].title} (öffnet in einem neuen Tab)`, exact: true }))
    .toHaveAttribute('href', question.sources[0].url);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Richtig beantwortet.', exact: true })).toBeVisible();
  const restored = await snapshot(page);
  expect(restored.lifetimeXp).toBe(10);
  expect(restored.currentAttempt?.id).toBe(original.currentAttempt?.id);
  expect(restored.currentAttempt?.choiceIds).toEqual(original.currentAttempt?.choiceIds);
  await page.getByRole('button', { name: 'Nächste Frage', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).currentAttempt?.id).not.toBe(original.currentAttempt?.id);
  await choose(page, false);
  await expect(page.getByRole('heading', { name: 'Noch nicht richtig.', exact: true })).toBeVisible();
  expect((await snapshot(page)).lifetimeXp).toBe(10);
});

test('custom inclusive year filter persists and invalid intervals do not widen it', async ({ page }) => {
  await page.goto('./');
  const year = bank[0].startYear;
  await setRange(page, year, year);
  await expect.poll(async () => (await snapshot(page)).range).toEqual({ startYear: year, endYear: year });
  const question = await questionFor(page);
  expect(question.startYear).toBeLessThanOrEqual(year);
  expect(question.endYear).toBeGreaterThanOrEqual(year);
  await page.reload();
  await expect(page.getByLabel('Von Jahr', { exact: true })).toHaveValue(String(year));
  await setRange(page, year + 1, year);
  await expect(page.getByRole('alert')).toBeVisible();
  expect((await snapshot(page)).range).toEqual({ startYear: year, endYear: year });
});

test('an eligible gap stays empty rather than resetting the filter', async ({ page }) => {
  const first = Math.min(...bank.map(question => question.startYear));
  const last = Math.max(...bank.map(question => question.endYear));
  const gap = Array.from({ length: last - first + 1 }, (_, index) => first + index)
    .find(year => !bank.some(question => question.startYear <= year && question.endYear >= year));
  if (gap === undefined) throw new Error('Authored bank needs an uncovered year for the real empty-filter scenario');
  await page.goto('./');
  await setRange(page, gap, gap);
  await expect.poll(async () => (await snapshot(page)).currentAttempt).toBeNull();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await page.reload();
  expect((await snapshot(page)).range).toEqual({ startYear: gap, endYear: gap });
  await expect(page.getByRole('radio')).toHaveCount(0);
});

test('keyboard-only answer flow works', async ({ page }) => {
  await page.goto('./');
  const radio = page.getByRole('radio').first();
  await radio.focus();
  await page.keyboard.press('Space');
  await expect(radio).toBeChecked();
  const submit = page.getByRole('button', { name: 'Antwort prüfen', exact: true });
  await expect(submit).toBeEnabled();
  await submit.focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await snapshot(page)).currentAttempt?.phase).toBe('answered');
  await expect(page.getByRole('button', { name: 'Nächste Frage', exact: true })).toBeEnabled();
});

test('actual context reflows at 320px with doubled text and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('./');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await choose(page, true);
  await page.getByRole('button', { name: 'Fakt & Einordnung ansehen', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.locator('.history-backside').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
});

test('storage denial and missing Web Locks are visible session-only states', async ({ browser, baseURL }) => {
  for (const scenario of ['storage', 'locks']) {
    const context = await browser.newContext({ baseURL });
    await context.addInitScript(mode => {
      if (mode === 'storage') {
        Object.defineProperty(window, 'localStorage', {
          get() { throw new DOMException('Access denied', 'SecurityError'); },
        });
      } else {
        Object.defineProperty(navigator, 'locks', { value: undefined });
      }
    }, scenario);
    const page = await context.newPage();
    await page.goto('./');
    await expect(page.getByText(/Nur diese Sitzung:/)).toBeVisible();
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Nächste Frage', exact: true })).toBeEnabled();
    await context.close();
  }
});

test('corrupt data remains untouched until confirmed reset', async ({ page }) => {
  const corrupted = '{"version":99,"important":"do not overwrite"}';
  await page.addInitScript(({ storageKey, raw }) => {
    if (localStorage.getItem(storageKey) === null) localStorage.setItem(storageKey, raw);
  }, { storageKey: key, raw: corrupted });
  await page.goto('./');
  await expect(page.getByText(/Nur diese Sitzung:/)).toBeVisible();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click();
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(corrupted);
  await page.getByRole('button', { name: 'Fortschritt zurücksetzen', exact: true }).click();
  await page.getByRole('button', { name: 'Ja, Fortschritt löschen', exact: true }).click();
  await expect(page.getByText(/Nur diese Sitzung:/)).toHaveCount(0);
  expect((await snapshot(page)).lifetimeXp).toBe(0);
});

test('a singleton filter permits repeated fresh attempts to earn XP without inflating mastery', async ({ page }) => {
  const first = Math.min(...bank.map(question => question.startYear));
  const last = Math.max(...bank.map(question => question.endYear));
  const year = Array.from({ length: last - first + 1 }, (_, index) => first + index)
    .find(year => bank.filter(question => question.startYear <= year && question.endYear >= year).length === 1);
  if (year === undefined) throw new Error('Expected a singleton year in the authored question bank');
  await page.goto('./');
  await setRange(page, year, year);
  await expect.poll(async () => (await snapshot(page)).range).toEqual({ startYear: year, endYear: year });
  await choose(page, true);
  const firstAttempt = (await snapshot(page)).currentAttempt!;
  await page.getByRole('button', { name: 'Fakt & Einordnung ansehen', exact: true }).click();
  await page.getByRole('button', { name: 'Nächste Frage', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).currentAttempt?.id).not.toBe(firstAttempt.id);
  expect((await snapshot(page)).currentAttempt?.questionId).toBe(firstAttempt.questionId);
  await expect(page.getByRole('radio')).toHaveCount(4);
  await choose(page, true);
  const state = await snapshot(page);
  expect(state.lifetimeXp).toBe(20);
  expect(state.progress[firstAttempt.questionId].attempts).toBe(2);
  await expect(page.locator('.history-xp-pill')).toContainText('20 XP');
});

test('quota failure announces unsaved session progress without overwriting the prior snapshot', async ({ page }) => {
  await page.addInitScript(storageKey => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === storageKey && JSON.parse(value).currentAttempt?.phase === 'answered') {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return original.call(this, name, value);
    };
  }, key);
  await page.goto('./');
  const question = await questionFor(page);
  const choice = question.choices.find(choice => choice.id === question.correctChoiceId)!;
  await page.getByRole('radio', { name: choice.text, exact: true }).check();
  await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Richtig beantwortet.', exact: true })).toBeVisible();
  await expect(page.getByText(/Nur diese Sitzung:/)).toBeVisible();
  expect((await snapshot(page)).lifetimeXp).toBe(0);
  expect((await snapshot(page)).currentAttempt?.phase).toBe('asking');
});

test('two real tabs cannot award the same attempt twice and synchronize feedback', async ({ context, page }) => {
  await page.goto('./');
  const second = await context.newPage();
  await second.goto('./');
  const question = await questionFor(page);
  const answer = question.choices.find(choice => choice.id === question.correctChoiceId)!;
  await page.getByRole('radio', { name: answer.text, exact: true }).check();
  await expect(second.getByRole('radio', { name: answer.text, exact: true })).toBeChecked();
  await page.evaluate(async () => {
    let acquired: () => void = () => {};
    const ready = new Promise<void>(resolve => { acquired = resolve; });
    void navigator.locks.request('grundwissen.progress.write', () => new Promise<void>(resolve => {
      window.addEventListener('release-history-test-lock', () => resolve(), { once: true });
      acquired();
    }));
    await ready;
  });
  await Promise.all([
    page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click(),
    second.getByRole('button', { name: 'Antwort prüfen', exact: true }).click(),
  ]);
  await page.evaluate(() => window.dispatchEvent(new Event('release-history-test-lock')));
  await expect(page.getByRole('heading', { name: 'Richtig beantwortet.', exact: true })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Richtig beantwortet.', exact: true })).toBeVisible();
  expect((await snapshot(page)).lifetimeXp).toBe(10);
  await second.reload();
  expect((await snapshot(second)).lifetimeXp).toBe(10);
});
