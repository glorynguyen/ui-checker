import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchLogic } from './search-logic.ts';

function tokenize(selector: string) {
  return selector.split(/(?=[.#])| /).map(t => t.trim()).filter(Boolean);
}

test('Exact ID Match', () => {
  const selector = "#main-header";
  const content = '<div id="main-header">Test</div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  assert.equal(result?.score, 100 + 10); // 100 (ID) + 10 (.html bonus)
});

test('Order Independent Classes', () => {
  const selector = ".btn.primary";
  const content = '<button class="primary btn">Test</button>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  // 30+30 (classes) + 10 (.html bonus) + 25 (co-occurrence) = 95
  assert.equal(result?.score, 95);
});

test('Tailwind Responsive Prefixes', () => {
  const selector = ".md:text-center .p-4";
  const content = '<div class="md:text-center p-4">Test</div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  // 10 (md:text-center) + 10 (p-4) = 20 baseScore
  // 20 * 0.15 = 3 (.html bonus)
  assert.equal(result?.score, 23);
});

test('React className Attribute', () => {
  const selector = ".product-card";
  const content = 'export const Card = () => <div className="product-card">Card</div>;';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('Card.tsx', content, tokens);
  // 30 (class) baseScore
  // 30 * 0.2 = 6 (.tsx bonus)
  assert.equal(result?.score, 36);
});

test('Disambiguation using Property/Value', () => {
  const selector = ".text-item";
  const property = "font-size";
  const value = "24px";
  const content = `
    <span class="text-item" style="font-size: 12px">Small</span>
    <span class="text-item" style="font-size: 24px">Big</span>
    <span class="text-item" style="font-size: 16px">Medium</span>
  `;
  const tokens = tokenize(selector);

  // Should pick line 2 (Big) because it matches property/value
  const result = SearchLogic.scoreFile('test.html', content, tokens, null, property, value);
  assert.equal(result?.line, 2);
  // 30 (class: semantic) + 10 (property bonus) = 40 baseScore
  // 40 * 0.15 = 6 (.html bonus)
  assert.equal(result?.score, 46);
});

test('CSS Selector Match', () => {
  const selector = ".nav-item";
  const content = `
    .nav-item {
      display: flex;
    }
    .nav-item:hover {
      color: blue;
    }
  `;
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('styles.css', content, tokens);
  // 30 (class) baseScore
  // 30 * 0.1 = 3 (.css bonus)
  assert.equal(result?.score, 33);
});

test('Avoid Partial Class Name Matches', () => {
  const selector = ".btn";
  const content = '<button class="btn-primary">Test</button>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  assert.equal(result, null);
});

test('Multi-Token Line Bonus', () => {
  const selector = "div.container.active";
  const content = `
    <div class="container">First</div>
    <div class="active">Second</div>
    <div class="container active">Target</div>
  `;
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);

  // Line 3 has most tokens (div, .container, .active)
  assert.equal(result?.line, 3);
  // 5 (tag) + 10 (container: utility) + 30 (active: semantic) = 45 base
  // line 2 co-occurrence: (div + active) = 2 tokens -> 25 bonus
  // line 3 co-occurrence: (div + container + active) = 3 tokens -> 50 bonus
  // total base = 45 + 25 + 50 = 120
  // .html bonus = Math.min(120 * 0.15, 10) = 10
  // total = 130
  assert.equal(result?.score, 130);
});

test('Hyphenated and Underscored Names', () => {
  const selector = ".my-custom_class";
  const content = '<div class="my-custom_class">Test</div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  // 30 (class: semantic because 'my-' without digit is not utility) baseScore
  // 30 * 0.15 = 4.5 -> round to 35
  assert.equal(result?.score, 35);
});

test('Tailwind Arbitrary Values', () => {
  const selector = ".top-[117px]";
  const content = '<div class="top-[117px]">Test</div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  // 10 (utility) + 1.5 (bonus) = 12
  assert.equal(result?.score, 12);
});

test('CSS Modules (CamelCase mapping)', () => {
  // Common pattern where .product-card becomes styles.productCard
  const selector = ".product-card";
  const content = 'import styles from "./styles.module.css"; ... <div className={styles.productCard}>';
  const tokens = tokenize(selector);
  // This currently fails because we look for the exact token. 
  // Future improvement: check for camelCase variant.
  const result = SearchLogic.scoreFile('Component.tsx', content, tokens);
  assert.equal(result, null); // Documenting current behavior
});

test('Nested Tailwind Variants', () => {
  const selector = ".dark:hover:bg-red-500";
  const content = '<div class="dark:hover:bg-red-500">Test</div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  // 10 (utility) + 1.5 (bonus) = 12
  assert.equal(result?.score, 12);
});

test('Complex CSS Selector combinations', () => {
  const selector = "div.container#main";
  const content = 'div.container#main { color: blue; }';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('styles.css', content, tokens);
  
  // Tag (5) + Class (10 - container is utility prefix) + ID (100) = 115
  // Co-occurrence: (3 tokens - 1) * 25 = 50
  // Total base = 165
  // .css bonus = Math.min(165 * 0.1, 8) = 8
  assert.equal(result?.score, 173);
});

test('Multi-line attributes in HTML/JSX', () => {
  const selector = ".target-class";
  const content = `
    <div
      id="some-id"
      className="
        other-class
        target-class
        another-class
      "
    >
  `;
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('Component.tsx', content, tokens);
  // Should match even with newlines in className
  assert.ok(result && result.score >= 30);
});

test('Property match with CSS variables', () => {
  const selector = ".card";
  const property = "background-color";
  const value = "var(--primary-color)";
  const content = '.card { background-color: var(--primary-color); }';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('styles.css', content, tokens, null, property, value);
  // Should handle var() values correctly
  assert.equal(result?.line, 0);
  assert.ok(result && result.score > 40);
});

test('Avoid matches in comments', () => {
  // This is a "known weakness" test - we currently match in comments
  const selector = ".secret-class";
  const content = '/* <div class="secret-class"> */';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.css', content, tokens);
  assert.ok(result !== null); 
});

test('Semantic class with utility prefix', () => {
  const selector = ".page-container";
  const content = '<div class="page-container">Test</div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  // 'page-' is not a utility prefix, so it should be semantic (30 points)
  // 30 * 0.15 = 4.5 -> round to 35
  assert.equal(result?.score, 35);
});

test('CSS Tag Selector Match', () => {
  const selector = "div";
  const content = 'div { color: red; }';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('styles.css', content, tokens);
  // 5 (tag) base
  // 5 * 0.1 = 0.5 -> round to 6
  assert.equal(result?.score, 6);
});

test('No Match', () => {
  const selector = ".missing-class";
  const content = '<div class="other-class">Test</div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  assert.equal(result, null);
});

// ─── Ancestor disambiguation ───

test('Ancestor bonus boosts files where parent class also appears', () => {
  const selector = ".btn";
  const tokens = tokenize(selector);
  const ancestors = [tokenize(".modal-footer")];

  const matchingFile = '<div class="modal-footer"><button class="btn">OK</button></div>';
  const otherFile = '<div class="toolbar"><button class="btn">OK</button></div>';

  const a = SearchLogic.scoreFile('a.txt', matchingFile, tokens, null, undefined, undefined, ancestors);
  const b = SearchLogic.scoreFile('b.txt', otherFile,    tokens, null, undefined, undefined, ancestors);

  assert.ok(a && b);
  // modal-footer is semantic -> +10 points
  assert.equal(a!.score - b!.score, 10);
});

test('Ancestor tokens alone do not fabricate a match', () => {
  const tokens = tokenize(".btn");
  const ancestors = [tokenize(".modal-footer")];
  const content = '<div class="modal-footer">No button here</div>';

  const result = SearchLogic.scoreFile('only-ancestor.html', content, tokens, null, undefined, undefined, ancestors);
  assert.equal(result, null);
});

test('Complex ancestor stack', () => {
  const tokens = tokenize(".btn");
  const ancestors = [tokenize("div#sidebar.nav")];

  const both    = '<div id="sidebar" class="nav"><button class="btn">OK</button></div>';
  const neither = '<div><button class="btn">OK</button></div>';

  const a = SearchLogic.scoreFile('a.txt', both,    tokens, null, undefined, undefined, ancestors);
  const b = SearchLogic.scoreFile('b.txt', neither, tokens, null, undefined, undefined, ancestors);

  assert.ok(a && b);
  // a gets 20 (capped from 30: div=5, #sidebar=15, .nav=10)
  // b gets 5 (div=5)
  // diff = 15
  assert.equal(a!.score - b!.score, 15);
});

test('Ancestors are backwards-compatible (omitted parameter)', () => {
  const tokens = tokenize(".btn");
  const content = '<div class="modal-footer"><button class="btn">OK</button></div>';

  const without = SearchLogic.scoreFile('a.html', content, tokens);
  const withEmpty = SearchLogic.scoreFile('a.html', content, tokens, null, undefined, undefined, []);

  assert.ok(without && withEmpty);
  assert.equal(without!.score, withEmpty!.score);
});
