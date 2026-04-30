import { SearchLogic } from './search-logic.ts';

const cases = [
  { name: 'Tailwind Prefixes', cls: 'md:text-center', content: '<div class="md:text-center p-4">Test</div>', expected: 12 },
  { name: 'Hyphenated Names', cls: 'my-custom_class', content: '<div class="my-custom_class">Test</div>', expected: 35 }
];

cases.forEach(({ name, cls, content, expected }) => {
  console.log(`--- Testing: ${name} [${cls}] ---`);
  const tokens = ['.' + cls];
  const result = SearchLogic.scoreFile('test.html', content, tokens);
  console.log('Result:', result);
  console.log('Expected:', expected);
  console.log('-------------------');
});
