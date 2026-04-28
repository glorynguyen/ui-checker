import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchLogic } from './search-logic';

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
  assert.equal(result?.score, 30 + 30 + 10); // 30+30 (classes) + 10 (.html bonus)
});

test('Tailwind Responsive Prefixes', () => {
  const selector = ".md:text-center.p-4";
  const content = '<div class="md:text-center p-4">Test</div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  assert.equal(result?.score, 10 + 10 + 10); // 10+10 (utilities) + 10 (.html bonus)
});

test('Source File Priority (.tsx over .html)', () => {
  const selector = ".product-card";
  const content = '<div class="product-card"></div>';
  const tokens = tokenize(selector);
  
  const s1 = SearchLogic.scoreFile('Product.tsx', content, tokens);
  const s2 = SearchLogic.scoreFile('Product.html', content, tokens);
  
  assert.ok((s1?.score || 0) > (s2?.score || 0));
});

test('Active File Bonus', () => {
  const selector = ".btn";
  const content = '<button class="btn"></button>';
  const tokens = tokenize(selector);
  
  const s1 = SearchLogic.scoreFile('test.html', content, tokens, 'test.html');
  const s2 = SearchLogic.scoreFile('test.html', content, tokens, 'other.html');
  
  assert.ok((s1?.score || 0) > (s2?.score || 0));
});

test('No Match', () => {
  const selector = ".missing-class";
  const content = '<div class="other-class">Test</div>';
  const tokens = tokenize(selector);
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  assert.equal(result, null);
});
