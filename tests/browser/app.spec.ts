import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { decodeSnapshot, freshSnapshot } from '../../src/domain/engine';
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

function answerRadio(page: Page, text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.getByRole('radio', { name: new RegExp(`^[A-D] ${escaped}$`) });
}

async function choose(page: Page, correct: boolean) {
  const question = await questionFor(page);
  const choice = question.choices.find(choice =>
    correct ? choice.id === question.correctChoiceId : choice.id !== question.correctChoiceId);
  if (!choice) throw new Error('Expected answer choice is missing');
  await answerRadio(page, choice.text).check();
  await expect.poll(async () => (await snapshot(page)).currentAttempt?.selectedChoiceId).toBe(choice.id);
  await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).currentAttempt?.phase).toBe('answered');
  return question;
}

async function setRange(page: Page, start: number, end: number) {
  if (!await page.getByLabel('Von Jahr', { exact: true }).isVisible()) {
    await page.locator('.history-filter-disclosure > summary').click();
  }
  await page.getByLabel('Von Jahr', { exact: true }).fill(String(start));
  await page.getByLabel('Bis Jahr', { exact: true }).fill(String(end));
  await page.getByRole('button', { name: 'Filter anwenden', exact: true }).click();
}

async function openSpecimen(page: Page, questionId: string) {
  const question = bank.find(question => question.id === questionId);
  if (!question) throw new Error(`Missing mobile layout specimen: ${questionId}`);
  const state = freshSnapshot(bank);
  if (!state.currentAttempt) throw new Error('Expected an initial attempt');
  state.currentAttempt = {
    ...state.currentAttempt, questionId: question.id, contentRevision: question.contentRevision,
    choiceIds: question.choices.map(choice => choice.id),
  };
  state.queue = state.queue.filter(id => id !== question.id);
  await page.addInitScript(({ storageKey, raw }) => {
    if (localStorage.getItem(storageKey) === null) localStorage.setItem(storageKey, raw);
  }, { storageKey: key, raw: JSON.stringify(state) });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: question.prompt, exact: true })).toBeVisible();
  return question;
}

test('mobile keyboard answers have question context, letters and stable feedback focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const question = await openSpecimen(page, 'gw-18-001');
  await expect(page.getByRole('group', { name: `Wähle eine Antwort zur Frage: ${question.prompt}`, exact: true })).toBeVisible();
  for (const [index, choice] of question.choices.entries()) {
    await expect(page.getByRole('radio').nth(index)).toHaveAccessibleName(`${String.fromCharCode(65 + index)} ${choice.text}`);
  }
  const feedback = page.locator('.history-question [role="status"]');
  await expect(feedback).toBeEmpty();
  const feedbackNode = await feedback.elementHandle();
  if (!feedbackNode) throw new Error('Feedback region must exist before an answer');
  const skip = page.getByRole('link', { name: 'Zur aktuellen Frage', exact: true });
  await skip.focus();
  const skipBox = await skip.boundingBox();
  expect(skipBox?.y).toBeGreaterThanOrEqual(0);
  expect(skipBox?.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Enter');
  await expect(page.locator('#history-practice')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).currentAttempt?.selectedChoiceId).toBe(question.choices[0].id);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Antwort prüfen', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  const result = page.getByRole('heading', { name: 'Richtig beantwortet.', exact: true });
  await expect(result).toBeFocused();
  await expect(result).toHaveAccessibleDescription('Die richtige Antwort ist: Immanuel Kant.');
  expect(await feedbackNode.evaluate(node => node === document.querySelector('.history-question [role="status"]'))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Fakt & Einordnung ansehen', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Wissen mit Zusammenhang', exact: true })).toBeFocused();
  const sourceTargets = await page.locator('.history-sources a').evaluateAll(links => links.map(link => {
    const rect = link.getBoundingClientRect();
    return { width: rect.width, height: rect.height, rowWidth: link.parentElement!.getBoundingClientRect().width };
  }));
  expect(sourceTargets.length).toBeGreaterThan(0);
  for (const target of sourceTargets) {
    expect(target.height).toBeGreaterThanOrEqual(44);
    expect(target.width).toBe(target.rowWidth);
  }
  await page.locator('.history-about-disclosure > summary').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('mobile reset starts safely, describes data loss and cancels with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openSpecimen(page, 'gw-18-001');
  await choose(page, true);
  const saved = await snapshot(page);
  await page.locator('.history-local-disclosure > summary').click();
  const reset = page.getByRole('button', { name: 'Fortschritt zurücksetzen', exact: true });
  await reset.focus();
  await page.keyboard.press('Enter');
  const cancel = page.getByRole('button', { name: 'Abbrechen', exact: true });
  const confirm = page.getByRole('button', { name: 'Ja, Fortschritt löschen', exact: true });
  await expect(cancel).toBeFocused();
  await expect(cancel).toHaveAccessibleDescription(/Das kann nicht rückgängig gemacht werden/);
  await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  await expect(confirm).toHaveAccessibleDescription(/Alle gespeicherten Antworten und XP/);
  await page.keyboard.press('Escape');
  await expect(reset).toBeFocused();
  await expect(cancel).toHaveCount(0);
  expect(await snapshot(page)).toEqual(saved);
  await page.keyboard.press('Enter');
  await cancel.click();
  await expect(reset).toBeFocused();
  expect(await snapshot(page)).toEqual(saved);
});

test('mobile initial storage warning describes focused question without stealing focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } });
  });
  await page.goto('./');
  const title = page.locator('.history-question-title');
  await expect(title).toBeFocused();
  await expect(title).toHaveAccessibleDescription(/Nur diese Sitzung: Fortschritt wird nicht dauerhaft gespeichert/);
  await expect(page.locator('#history-storage-notice')).toContainText('Nur diese Sitzung:');
  await page.getByRole('radio').first().check();
  await expect(page.getByRole('radio').first()).toBeFocused();
});

test('mobile error fills an existing alert without moving answer focus', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await openSpecimen(page, 'gw-18-001');
  const alert = page.getByRole('alert');
  await expect(alert).toBeEmpty();
  const alertNode = await alert.elementHandle();
  if (!alertNode) throw new Error('Alert region must exist before an error');
  await page.evaluate(storageKey => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) throw new Error('Expected persisted snapshot');
    const state = JSON.parse(raw);
    state.revision = Number.MAX_SAFE_INTEGER;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, key);
  await page.getByRole('radio').first().check();
  await expect(alert).toContainText('Die maximale Fortschrittsrevision ist erreicht.');
  await expect(page.getByRole('radio').first()).toBeFocused();
  expect(await alertNode.evaluate(node => node === document.querySelector('[role="alert"]'))).toBe(true);
});

for (const viewport of [
  { width: 320, height: 568 }, { width: 375, height: 667 },
  { width: 390, height: 844 }, { width: 430, height: 932 },
]) {
  test(`mobile quiz is readable and starts immediately at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openSpecimen(page, 'gw-18-001');
    const geometry = await page.evaluate(() => {
      const header = document.querySelector('.history-header')!.getBoundingClientRect();
      const practice = document.querySelector('.history-practice')!.getBoundingClientRect();
      const title = document.querySelector('.history-question-title')!;
      const answer = document.querySelector('.history-choice-text')!;
      const submit = document.querySelector('.history-question button[type="submit"]')!;
      return {
        top: practice.top + scrollY, headerBottom: header.bottom + scrollY,
        submitBottom: submit.getBoundingClientRect().bottom + scrollY,
        titleFont: parseFloat(getComputedStyle(title).fontSize),
        answerFont: parseFloat(getComputedStyle(answer).fontSize),
        buttonFont: parseFloat(getComputedStyle(submit).fontSize),
        radioSize: document.querySelector('.history-choice input')!.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth,
        targetHeights: [...document.querySelectorAll('.history-choice, .history-disclosure > summary, .history-question .history-button')]
          .map(element => element.getBoundingClientRect().height),
      };
    });
    expect(geometry.top).toBeLessThanOrEqual(geometry.headerBottom + 24);
    expect(geometry.titleFont).toBeGreaterThanOrEqual(22);
    expect(geometry.answerFont).toBeGreaterThanOrEqual(18);
    expect(geometry.buttonFont).toBeGreaterThanOrEqual(16);
    expect(geometry.radioSize).toBeGreaterThanOrEqual(24);
    expect(geometry.overflow).toBe(false);
    expect(Math.min(...geometry.targetHeights)).toBeGreaterThanOrEqual(44);
    if (viewport.width === 390) expect(geometry.submitBottom).toBeLessThanOrEqual(viewport.height);
    await expect(page.locator('.history-disclosure[open]')).toHaveCount(0);
    const previousScroll = await page.evaluate(() => scrollY);
    await page.getByRole('radio').first().check();
    expect(await page.evaluate(() => scrollY)).toBe(previousScroll);
    await choose(page, true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Richtig beantwortet.', exact: true })).toBeVisible();
    expect((await snapshot(page)).lifetimeXp).toBe(10);
  });
}

test('mobile disclosures preserve filters, journey, score and reset access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSpecimen(page, 'gw-18-001');
  const filter = page.locator('.history-filter-disclosure > summary');
  await filter.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Von Jahr', { exact: true })).toBeVisible();
  const initialRange = (await snapshot(page)).range;
  await page.getByRole('button', { name: /19. Jahrhundert/ }).click();
  expect((await snapshot(page)).range).toEqual(initialRange);
  await page.getByRole('button', { name: 'Filter anwenden', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).range).toEqual({ startYear: 1801, endYear: 1900 });
  await filter.click();
  await page.locator('.history-journey-disclosure > summary').click();
  await expect(page.getByRole('list', { name: 'Meilensteine in Schritten von 100 XP' })).toBeVisible();
  await page.getByText('Fortschritt im Zeitraum', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Dein Überblick für 1801–1900' })).toBeVisible();
  await page.getByText('Über Grundwissen', { exact: true }).click();
  await expect(page.getByText('Entdecke Zusammenhänge statt nur Jahreszahlen.', { exact: false })).toBeVisible();
  await page.getByText('Speicher & Zurücksetzen', { exact: true }).click();
  await page.getByRole('button', { name: 'Fortschritt zurücksetzen', exact: true }).click();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect((await snapshot(page)).range).toEqual({ startYear: 1801, endYear: 1900 });
  const first = Math.min(...bank.map(question => question.startYear));
  const last = Math.max(...bank.map(question => question.endYear));
  const gap = Array.from({ length: last - first + 1 }, (_, index) => first + index)
    .find(year => !bank.some(question => question.startYear <= year && question.endYear >= year));
  if (gap === undefined) throw new Error('Expected a gap year for the mobile filter scenario');
  await setRange(page, gap, gap);
  await page.locator('.history-filter-disclosure > summary').click();
  await expect(page.getByLabel('Von Jahr', { exact: true })).not.toBeVisible();
  await page.getByRole('link', { name: 'Zum Zeitfilter', exact: true }).click();
  await expect(page.getByLabel('Von Jahr', { exact: true })).toBeVisible();
});

test('long mobile context and resize keep reveal state and desktop composition', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await openSpecimen(page, 'gw-19-025');
  await choose(page, false);
  await page.getByRole('button', { name: 'Fakt & Einordnung ansehen', exact: true }).click();
  await expect(page.locator('.history-context')).toBeVisible();
  expect(await page.locator('.history-context').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.locator('.history-backside').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.setViewportSize({ width: 1280, height: 1000 });
  await expect(page.locator('.history-disclosure[open]')).toHaveCount(5);
  await expect(page.locator('.history-backside')).toBeVisible();
  const desktop = await page.evaluate(() => ({
    columns: getComputedStyle(document.querySelector('.history-layout')!).gridTemplateColumns.split(' ').length,
    sidebarLeft: document.querySelector('.history-sidebar')!.getBoundingClientRect().left,
    questionLeft: document.querySelector('.history-question')!.getBoundingClientRect().left,
  }));
  expect(desktop.columns).toBe(2);
  expect(desktop.sidebarLeft).toBeLessThan(desktop.questionLeft);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.locator('.history-backside')).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

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
  await expect(page.locator('.history-filter').getByRole('alert')).toBeVisible();
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
  await expect(page.locator('.history-question-title')).toBeFocused();
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
  await answerRadio(page, choice.text).check();
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
  await answerRadio(page, answer.text).check();
  await expect(answerRadio(second, answer.text)).toBeChecked();
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
