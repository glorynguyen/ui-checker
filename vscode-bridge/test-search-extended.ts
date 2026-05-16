import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchLogic } from './search-logic.ts';

function tokenize(selector: string) {
  return selector.split(/(?=[.#])| /).map(t => t.trim()).filter(Boolean);
}

test('isUtility - exhaustive check', () => {
  // Exact matches
  assert.strictEqual(SearchLogic.isUtility('flex'), true);
  assert.strictEqual(SearchLogic.isUtility('.relative'), true);
  assert.strictEqual(SearchLogic.isUtility('block'), true);
  
  // Prefixes + digits
  assert.strictEqual(SearchLogic.isUtility('p-4'), true);
  assert.strictEqual(SearchLogic.isUtility('m-0'), true);
  assert.strictEqual(SearchLogic.isUtility('z-10'), true);
  assert.strictEqual(SearchLogic.isUtility('opacity-50'), true);
  
  // Prefixes + brackets
  assert.strictEqual(SearchLogic.isUtility('w-[100px]'), true);
  assert.strictEqual(SearchLogic.isUtility('bg-[#ff0000]'), true);
  assert.strictEqual(SearchLogic.isUtility('grid-cols-[1fr_auto]'), true);
  
  // Variants
  assert.strictEqual(SearchLogic.isUtility('hover:bg-blue-500'), true);
  assert.strictEqual(SearchLogic.isUtility('sm:p-2'), true);
  assert.strictEqual(SearchLogic.isUtility('dark:text-white'), true);
  assert.strictEqual(SearchLogic.isUtility('group-hover:opacity-100'), true);
  
  // Nested variants
  assert.strictEqual(SearchLogic.isUtility('sm:hover:bg-red-500'), true);
  
  // NOT utility
  assert.strictEqual(SearchLogic.isUtility('page-container'), false);
  assert.strictEqual(SearchLogic.isUtility('btn-primary'), false);
  assert.strictEqual(SearchLogic.isUtility('main-header'), false);
  assert.strictEqual(SearchLogic.isUtility('p-custom'), false); // p- followed by non-digit/bracket
});

test('Case Insensitivity for Properties/Values', () => {
  const selector = ".card";
  const property = "Display";
  const value = "FLEX";
  const content = '<div class="card" style="display: flex"></div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens, null, property, value);
  
  assert.ok(result);
  assert.equal(result.line, 0);
  // 10 (card is utility prefix? wait, c- is not. card is semantic -> 30)
  // 30 (class) + 10 (property file bonus) = 40 base
  // 40 * 0.15 = 6 bonus
  // Total = 46
  assert.equal(result.score, 46);
});

test('Special Characters in IDs and Classes', () => {
  const selector = "#header\\:main.u-full-width";
  const content = '<div id="header:main" class="u-full-width"></div>';
  const tokens = ["#header:main", ".u-full-width"];
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  
  assert.ok(result);
  // 100 (ID) + 30 (Class) = 130 base
  // Co-occurrence: (2-1)*25 = 25
  // Total base = 155
  // HTML bonus = 10 (capped)
  // Total = 165
  assert.equal(result.score, 165);
});

test('File Type Bonuses - Vue/Svelte/Astro', () => {
  const selector = ".item";
  const content = '<div class="item"></div>';
  const tokens = tokenize(selector);
  
  const vueResult = SearchLogic.scoreFile('test.vue', content, tokens);
  const svelteResult = SearchLogic.scoreFile('test.svelte', content, tokens);
  const astroResult = SearchLogic.scoreFile('test.astro', content, tokens);
  const scssResult = SearchLogic.scoreFile('test.scss', content, tokens);
  
  // base = 30
  // vue/svelte/astro bonus = 30 * 0.15 = 4.5 -> 35
  assert.equal(vueResult?.score, 35);
  assert.equal(svelteResult?.score, 35);
  assert.equal(astroResult?.score, 35);
  
  // scss bonus = 30 * 0.1 = 3 -> 33
  assert.equal(scssResult?.score, 33);
});

test('Best Line selection with multiple matches', () => {
  const selector = ".target";
  const content = `
    <div class="target">Line 1 (Single)</div>
    <div>Noise</div>
    <div class="target other">Line 3 (Double)</div>
    <div class="target">Line 4 (Single)</div>
    <div>Noise</div>
  `;
  const tokens = tokenize(".target.other");
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  
  // Line 3 matches both tokens
  assert.equal(result?.line, 3);
});

test('Score File - ID only', () => {
  const tokens = tokenize("#unique-id");
  const content = '<div id="unique-id"></div>';
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  // 100 + 10 = 110
  assert.equal(result?.score, 110);
});

test('Score File - Tag only', () => {
  const tokens = tokenize("section");
  const content = '<section></section>';
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  // 5 + 0.75 -> 6
  assert.equal(result?.score, 6);
});

test('Utility class detection in scoreFile', () => {
  const selector = ".p-4";
  const content = '<div class="p-4"></div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  // 10 (utility) + 1.5 -> 12
  assert.equal(result?.score, 12);
});

test('Complex score with property but no token match on that line', () => {
  const selector = ".card";
  const property = "color";
  const value = "red";
  const content = `
    <div class="card"></div>
    <div style="color: red"></div>
  `;
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens, null, property, value);
  
  assert.ok(result);
  // Total Score calculation:
  // Class .card found -> totalScore += 30
  // Property color: red found -> totalScore += 10 (propertyFileBonus)
  // Property color: red found on line 2, but lineMatchCount[2] is 0 -> lineScores[2] += 20
  // .card found on line 1 -> lineScores[1] += 30
  
  // Base score = 30 + 10 = 40
  // HTML bonus = 40 * 0.15 = 6
  // Total = 46
  assert.equal(result.score, 46);
  // Best line should be line 1 because it has the token, even though line 2 has the property.
  // lineScores[1] = 30, lineScores[2] = 20.
  assert.equal(result.line, 1);
});

test('Active file and source name hints boost the likely component line', () => {
  const tokens = tokenize('.target');
  const content = [
    'export function ProductCard() {',
    '  return <div className="target">Card</div>;',
    '}'
  ].join('\n');

  const result = SearchLogic.scoreFile(
    '/repo/ProductCard.tsx',
    content,
    tokens,
    '/repo/ProductCard.tsx',
    undefined,
    undefined,
    undefined,
    'ProductCard'
  );

  assert.ok(result);
  assert.equal(result.line, 0);
  // class 30 + source-name 60 + active-file 50 + tsx bonus capped at 15
  assert.equal(result.score, 155);
});

test('Invalid source names and unmatched property keys do not add hint bonuses', () => {
  const tokens = tokenize('.target');
  const content = [
    'export function ProductCard() {',
    '  return <div className="target">Card</div>;',
    '}'
  ].join('\n');

  const result = SearchLogic.scoreFile(
    '/repo/ProductCard.tsx',
    content,
    tokens,
    null,
    'padding-left',
    undefined,
    undefined,
    'Product-Card'
  );

  assert.ok(result);
  assert.equal(result.score, 36);
});

test('Ancestor helper handles ids, tags, utility skips, and caps score', () => {
  const ancestorTokens = tokenize('section#sidebar.modal.p-4.extra.another.more');
  const content = '<section id="sidebar" class="modal extra another more p-4"></section>';

  assert.equal(SearchLogic._scoreAncestor(content, ancestorTokens, false), 20);
  assert.equal(SearchLogic._fileMentionsAncestor(content, tokenize('.modal')), true);
  assert.equal(SearchLogic._fileMentionsAncestor(content, tokenize('.missing')), false);
});

test('findLine falls back to the first line when no pattern is present', () => {
  assert.equal(SearchLogic._findLine(['alpha', 'beta'], 'beta'), 1);
  assert.equal(SearchLogic._findLine(['alpha', 'beta'], 'gamma'), 0);
});
