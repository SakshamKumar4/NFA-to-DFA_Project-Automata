// Run with:  node tests/run-tests.js   (no dependencies; exit code 1 if any test fails)
const N = require('../src/nfa-dfa.js');
const EXAMPLES = require('../src/examples.js');
const { runAllTests } = require('./cases.js');

const rows = runAllTests(N, EXAMPLES);
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
console.log('ID'.padEnd(14) + 'Result  Feature / input -> expected | actual');
for (const r of rows) {
  console.log(r.id.padEnd(14) + (r.pass ? 'PASS    ' : 'FAIL    ') + cut(r.feature, 70));
  if (!r.pass) console.log('        input: ' + r.input + '\n        expected: ' + r.expected + '\n        actual:   ' + r.actual);
}
const failed = rows.filter(r => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
