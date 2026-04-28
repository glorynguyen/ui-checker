const { calculateScore } = require('./search-logic');

const tests = [
    {
        name: "Exact ID Match",
        selector: "#main-header",
        content: '<div id="main-header">Test</div>',
        expectedScore: 100
    },
    {
        name: "Order Independent Classes",
        selector: ".btn.primary",
        content: '<button class="primary btn">Test</button>',
        expectedScore: 60
    },
    {
        name: "Tailwind Responsive Prefixes",
        selector: ".md:text-center.p-4",
        content: '<div class="md:text-center p-4">Test</div>',
        expectedScore: 20 // 2 classes (20) + 0 unique (both are utilities)
    },
    {
        name: "Source File Priority (.tsx over .html)",
        selector: ".product-card",
        content: '<div class="product-card"></div>',
        options1: { fileName: 'Product.tsx' },
        options2: { fileName: 'Product.html' },
        compare: (s1, s2) => s1.score > s2.score // TSX should have higher score
    },
    {
        name: "Tailwind Detection (Utility Filtering)",
        selector: ".card.text-center",
        content: '<div class="card text-center"></div>',
        options1: { isTailwind: true },  // Should filter text-center
        options2: { isTailwind: false }, // Should treat text-center as unique
        compare: (s1, s2) => s2.score > s1.score // Non-tailwind score should be higher (more unique matches)
    },
    {
        name: "Active File Bonus",
        selector: ".btn",
        content: '<button class="btn"></button>',
        options1: { isActiveFile: true },
        options2: { isActiveFile: false },
        compare: (s1, s2) => s1.score > s2.score
    },
    {
        name: "No Match",
        selector: ".missing-class",
        content: '<div class="other-class">Test</div>',
        expectedScore: 0
    }
];

let passCount = 0;

console.log("🚀 Running UI Bridge Logic Tests...\n");

tests.forEach(t => {
    if (t.compare) {
        const s1 = calculateScore(t.selector, t.content, t.options1?.isActiveFile || false, t.options1 || {});
        const s2 = calculateScore(t.selector, t.content, t.options2?.isActiveFile || false, t.options2 || {});
        if (t.compare(s1, s2)) {
            console.log(`✅ PASS: ${t.name}`);
            passCount++;
        } else {
            console.error(`❌ FAIL: ${t.name} (Scores: ${s1.score} vs ${s2.score})`);
        }
    } else {
        const result = calculateScore(t.selector, t.content, false, t.options || {});
        if (result.score === t.expectedScore) {
            console.log(`✅ PASS: ${t.name}`);
            passCount++;
        } else {
            console.error(`❌ FAIL: ${t.name} (Expected ${t.expectedScore}, got ${result.score})`);
        }
    }
});

console.log(`\n🎉 All tests finished: ${passCount}/${tests.length} passed.`);
if (passCount !== tests.length) process.exit(1);
