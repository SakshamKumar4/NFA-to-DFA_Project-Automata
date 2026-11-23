/**
 * cases.js - automated tests for the algorithm module. Used by BOTH the Node runner
 * (tests/run-tests.js) and the "Automated tests" table in the web page.
 * Each row: id, feature, input, expected, actual, pass. Transition tables are compared by
 * subset contents (labels and discovery order are ignored).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function runAllTests(N, EXAMPLES) {
    const rows = [], fmt = N.formatSubset;
    const ex = id => EXAMPLES.find(e => e.id === id);
    const check = (id, feature, input, expected, actual, pass) =>
      rows.push({ id, feature, input, expected: String(expected), actual: String(actual), pass: pass === undefined ? String(expected) === String(actual) : pass });
    const safe = fn => { try { return fn(); } catch (e) { return e; } };
    const build = def => { const nfa = N.validateNfa(def); return { nfa, dfa: N.convertNfaToDfa(nfa) }; };
    // Label-independent text form of a DFA table: "subset*[a→target b→target]" (* = accepting), sorted.
    const sig = dfa => dfa.states.map(s => `${fmt(s.subset)}${s.accepting ? '*' : ''}[` +
      dfa.alphabet.map(a => `${a}→${fmt(dfa.states[dfa.delta[s.id][a]].subset)}`).join(' ') + ']').sort().join(' ; ');
    const hand = (alphabet, table) => table.map(([S, acc, t]) => `${fmt(S)}${acc ? '*' : ''}[` +
      alphabet.map(a => `${a}→${fmt(t[a])}`).join(' ') + ']').sort().join(' ; ');
    const verdict = b => b ? 'Accept' : 'Reject';
    const table = (id, feature, exId, expectedRows) => {
      const e = ex(exId); check(id, feature, 'transition table of "' + e.name + '"', hand(e.definition.alphabet, expectedRows), sig(build(e.definition).dfa));
    };

    // --- generated transition tables ---
    const c01 = ex('contains01'), c01b = build(c01.definition);
    check('T01', 'Contains 01: hand-worked table (M1 report)', 'transition table', hand(['0', '1'], c01.handTable), sig(c01b.dfa));
    check('T02', 'Contains 01: exactly four reachable subsets', 'number of DFA states', 4, c01b.dfa.states.length);
    check('T03', 'Contains 01: ∅ is unreachable', 'any dead state?', 'no', c01b.dfa.states.some(s => s.dead) ? 'yes' : 'no');
    table('T04', 'Ordinary branching (ends with 01)', 'ends01', [
      [['q0'], false, { 0: ['q0', 'q1'], 1: ['q0'] }], [['q0', 'q1'], false, { 0: ['q0', 'q1'], 1: ['q0', 'q2'] }], [['q0', 'q2'], true, { 0: ['q0', 'q1'], 1: ['q0'] }]]);
    table('T05', 'Reachable trap: missing transition gives ∅ with self-loops', 'dead', [
      [['q0'], false, { 0: ['q1'], 1: [] }], [['q1'], true, { 0: ['q1'], 1: ['q1'] }], [[], false, { 0: [], 1: [] }]]);
    table('T06', 'ε-chain with cycle + ε after consuming a symbol', 'eps-cycle', [
      [['q0', 'q1', 'q2'], false, { a: ['q3', 'q4'], b: [] }], [['q3', 'q4'], true, { a: [], b: [] }], [[], false, { a: [], b: [] }]]);
    table('T07', 'Start closure accepting', 'eps-accept', [
      [['q0', 'q1'], true, { 0: ['q1'], 1: [] }], [['q1'], true, { 0: ['q1'], 1: [] }], [[], false, { 0: [], 1: [] }]]);
    table('T08', 'Unreachable NFA state q3 (same table as ends with 01)', 'unreachable', [
      [['q0'], false, { 0: ['q0', 'q1'], 1: ['q0'] }], [['q0', 'q1'], false, { 0: ['q0', 'q1'], 1: ['q0', 'q2'] }], [['q0', 'q2'], true, { 0: ['q0', 'q1'], 1: ['q0'] }]]);
    const un = build(ex('unreachable').definition).dfa;
    check('T09', 'Unreachable NFA state never appears in a subset', 'subsets containing q3', 0, un.states.filter(s => s.subset.includes('q3')).length);
    const rep = { states: ['q0', 'q1', 'q2'], alphabet: ['a', 'b'], start: 'q0', accepting: ['q2'],
      transitions: [{ from: 'q0', symbol: 'a', to: ['q1'] }, { from: 'q0', symbol: 'a', to: ['q2'] }, { from: 'q0', symbol: 'b', to: ['q2', 'q1'] }] };
    const rb = build(rep);
    check('T10', 'Repeated rows merged; same subset found in a different order is one DFA state', 'q0 a→q1 + q0 a→q2; q0 b→q2,q1', 3, rb.dfa.states.length);
    check('T11', 'Repeated subset: a and b lead to the same DFA state', 'δ(A,a) = δ(A,b)?', 'yes', rb.dfa.delta[0].a === rb.dfa.delta[0].b ? 'yes' : 'no');
    check('T12', 'Canonical subset order', "canonical(['q2','q0','q1'])", 'q0,q1,q2', N.canonical(c01b.nfa, ['q2', 'q0', 'q1']).join(','));
    check('T13', 'Third symbol from the end: 2^3 reachable subsets', 'number of DFA states', 8, build(ex('third-last').definition).dfa.states.length);

    table('T35', 'Even a and even b: 4 states, same table as the deterministic machine', 'even-ab', [
      [['q0'], true, { a: ['q1'], b: ['q2'] }], [['q1'], false, { a: ['q0'], b: ['q3'] }],
      [['q2'], false, { a: ['q3'], b: ['q0'] }], [['q3'], false, { a: ['q2'], b: ['q1'] }]]);
    table('T36', 'Even number of 0s', 'even-0', [
      [['q0'], true, { 0: ['q1'], 1: ['q0'] }], [['q1'], false, { 0: ['q0'], 1: ['q1'] }]]);

    // --- ε-closure ---
    const cyc = build(ex('eps-cycle').definition).nfa;
    check('T14', 'ε-closure terminates on a cycle', "closure({q0})", '{q0, q1, q2}', fmt(N.epsilonClosure(cyc, ['q0'])));
    check('T15', 'ε-closure follows a chain through a cycle', "closure({q2})", '{q1, q2}', fmt(N.epsilonClosure(cyc, ['q2'])));
    check('T16', 'No ε-transitions: closure returns the same set', "closure({q0,q1})", '{q0, q1}', fmt(N.epsilonClosure(c01b.nfa, ['q0', 'q1'])));

    // --- strings: empty string, accepting / rejecting, invalid symbols ---
    const eacc = build(ex('eps-accept').definition);
    check('T17', 'Empty string accepted when start closure is accepting', 'ε', 'Accept', verdict(N.simulateDfa(eacc.dfa, '').accepted));
    check('T18', 'Empty string rejected when start closure is not accepting', 'ε', 'Reject', verdict(N.simulateDfa(c01b.dfa, '').accepted));
    const none = build({ states: ['q0', 'q1'], alphabet: ['0', '1'], start: 'q0', accepting: [], transitions: [{ from: 'q0', symbol: '0', to: ['q1'] }, { from: 'q1', symbol: '1', to: ['q0'] }] });
    check('T19', 'Empty accepting set: no accepting DFA state', 'accepting DFA states', 0, none.dfa.states.filter(s => s.accepting).length);
    check('T20', 'Empty accepting set: every string rejected', 'ε, 0, 01, 010', 'Reject ×4', ['', '0', '01', '010'].map(w => verdict(N.simulateDfa(none.dfa, w).accepted)).join(',') === 'Reject,Reject,Reject,Reject' ? 'Reject ×4' : 'some accepted');
    const e1 = safe(() => N.simulateNfa(c01b.nfa, '012')), e2 = safe(() => N.simulateDfa(c01b.dfa, '012'));
    check('T21', 'Invalid symbol: NFA and DFA report the SAME error', '"012"', 'identical ValidationError', e1 instanceof N.ValidationError && e2 instanceof N.ValidationError && e1.message === e2.message ? 'identical ValidationError' : 'differ', undefined);
    check('T22', 'Blank string means ε (one step, step 0 only)', '""', 1, N.simulateNfa(c01b.nfa, '').steps.length);

    // --- malformed definitions ---
    const base = { states: ['q0', 'q1'], alphabet: ['0', '1'], start: 'q0', accepting: ['q1'], transitions: [] };
    const bad = (id, feature, patch, needle) => {
      const e = safe(() => N.validateNfa(Object.assign({}, base, patch)));
      const ok = e instanceof N.ValidationError && e.errors.join(' ').includes(needle);
      check(id, feature, JSON.stringify(patch), `ValidationError containing "${needle}"`, e instanceof N.ValidationError ? e.errors[0] : 'no error', ok);
    };
    bad('T23', 'Unknown target state', { transitions: [{ from: 'q0', symbol: '0', to: ['q9'] }] }, 'unknown target state');
    bad('T24', 'Unknown source state', { transitions: [{ from: 'qX', symbol: '0', to: ['q1'] }] }, 'unknown source state');
    bad('T25', 'Symbol outside the alphabet', { transitions: [{ from: 'q0', symbol: '2', to: ['q1'] }] }, 'not in the alphabet');
    bad('T26', 'Unknown start state', { start: 'z' }, 'Start state');
    bad('T27', 'Unknown accepting state', { accepting: ['z'] }, 'Accepting state');
    bad('T28', 'Duplicate alphabet symbol', { alphabet: ['0', '0'] }, 'Duplicate alphabet symbol');
    bad('T29', 'Multi-character alphabet symbol', { alphabet: ['ab'] }, 'exactly one');
    bad('T30', 'ε inside the alphabet', { alphabet: ['0', 'ε'] }, 'reserved');
    bad('T31', 'No states', { states: [], start: 'q0', accepting: [] }, 'at least one state');
    bad('T32', 'Duplicate state names', { states: ['q0', 'q0'] }, 'unique');

    // --- safety limit and bounded testing ---
    const third = N.validateNfa(ex('third-last').definition);
    const lim = safe(() => N.convertNfaToDfa(third, { maxDfaStates: 4 }));
    check('T33', 'Safety limit: no partial DFA is returned', 'maxDfaStates = 4 on an 8-state DFA', 'LimitError (nothing returned)', lim instanceof N.LimitError ? 'LimitError (nothing returned)' : 'returned a DFA');
    const bnd = N.compareBounded(c01b.nfa, c01b.dfa, 20, 500);
    check('T34', 'Bounded check enforces the budget before generating strings', 'binary, requested length 20, budget 500', 'tested length 7, 255 strings, not complete', `tested length ${bnd.testedLength}, ${bnd.count} strings, ${bnd.complete ? 'complete' : 'not complete'}`);

    // --- every preset: DFA vs NFA simulator vs independent path-search oracle ---
    for (const e of EXAMPLES) {
      const { nfa, dfa } = build(e.definition);
      const cmp = N.compareBounded(nfa, dfa, 8, 2000);
      check('B-' + e.id, `Bounded DFA vs path-search oracle: ${e.name}`, `all strings up to length ${cmp.testedLength} (${cmp.count})`, '0 mismatches', `${cmp.mismatchCount} mismatches`);
      e.tests.forEach((tc, k) => {
        const d = N.simulateDfa(dfa, tc.input).accepted, n = N.simulateNfa(nfa, tc.input).accepted, o = N.acceptsByPathSearch(nfa, [...tc.input]);
        check(`S-${e.id}-${k + 1}`, `Preset: ${e.name}`, tc.input === '' ? 'ε' : `"${tc.input}"`, verdict(tc.expected), `DFA ${verdict(d)} / NFA ${verdict(n)} / oracle ${verdict(o)}`, d === tc.expected && n === tc.expected && o === tc.expected);
      });
    }
    return rows;
  }
  return { runAllTests };
});
