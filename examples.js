/** examples.js - preset automata (plain data, no logic). Every preset goes through the same converter as custom input. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Examples = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const t = (from, symbol, ...to) => ({ from, symbol, to });
  const eps = 'ε';
  const yes = (input) => ({ label: `Accepted: "${input}"`, input, expected: true });
  const no = (input) => ({ label: `Rejected: "${input}"`, input, expected: false });
  const empty = (expected) => ({ label: 'ε (empty string)', input: '', expected });

  return [
    { id: 'contains01', name: 'Contains “01” (M1 example)',
      note: 'Ordinary nondeterminism: on 0, q0 also guesses that “01” starts here. Expect 4 reachable subsets; ∅ is never reached.',
      definition: { states: ['q0', 'q1', 'q2'], alphabet: ['0', '1'], start: 'q0', accepting: ['q2'],
        transitions: [t('q0', '0', 'q0', 'q1'), t('q0', '1', 'q0'), t('q1', '1', 'q2'), t('q2', '0', 'q2'), t('q2', '1', 'q2')] },
      tests: [yes('1001'), no('10'), empty(false)],
      // Hand-worked table from the M1 report: [subset, accepting?, {symbol: target subset}]
      handTable: [
        [['q0'], false, { 0: ['q0', 'q1'], 1: ['q0'] }],
        [['q0', 'q1'], false, { 0: ['q0', 'q1'], 1: ['q0', 'q2'] }],
        [['q0', 'q2'], true, { 0: ['q0', 'q1', 'q2'], 1: ['q0', 'q2'] }],
        [['q0', 'q1', 'q2'], true, { 0: ['q0', 'q1', 'q2'], 1: ['q0', 'q2'] }]],
      noDeadNote: 'Every reachable subset contains q0, and q0 has a move on both 0 and 1, so move(S, a) is never empty. ∅ is therefore unreachable and is not built.' },
    { id: 'ends01', name: 'Ends with 01',
      note: 'Branching: q0 has two targets on 0. Three reachable subsets.',
      definition: { states: ['q0', 'q1', 'q2'], alphabet: ['0', '1'], start: 'q0', accepting: ['q2'],
        transitions: [t('q0', '0', 'q0', 'q1'), t('q0', '1', 'q0'), t('q1', '1', 'q2')] },
      tests: [yes('1101'), no('0110'), empty(false)] },
    { id: 'dead', name: 'Reachable dead state (starts with 0)',
      note: 'q0 has no move on 1, so move({q0}, 1) = ∅. The empty set becomes a non-accepting dead state with a self-loop on every symbol.',
      definition: { states: ['q0', 'q1'], alphabet: ['0', '1'], start: 'q0', accepting: ['q1'],
        transitions: [t('q0', '0', 'q1'), t('q1', '0', 'q1'), t('q1', '1', 'q1')] },
      tests: [yes('011'), no('10'), empty(false)] },
    { id: 'eps-cycle', name: 'ε-chain with a cycle',
      note: 'q0 →ε q1 →ε q2 →ε q1 (cycle), q1 –a→ q3 →ε q4. Shows closure with a cycle and an ε-move AFTER consuming a symbol.',
      definition: { states: ['q0', 'q1', 'q2', 'q3', 'q4'], alphabet: ['a', 'b'], start: 'q0', accepting: ['q4'],
        transitions: [t('q0', eps, 'q1'), t('q1', eps, 'q2'), t('q2', eps, 'q1'), t('q1', 'a', 'q3'), t('q3', eps, 'q4')] },
      tests: [yes('a'), no('ab'), empty(false)] },
    { id: 'eps-accept', name: 'Start closure is accepting (accepts ε)',
      note: 'q0 →ε q1 and q1 is accepting, so ε-closure({q0}) = {q0, q1} already accepts: the empty string is accepted.',
      definition: { states: ['q0', 'q1'], alphabet: ['0', '1'], start: 'q0', accepting: ['q1'],
        transitions: [t('q0', eps, 'q1'), t('q1', '0', 'q1')] },
      tests: [empty(true), yes('000'), no('01')] },
    { id: 'unreachable', name: 'NFA with an unreachable state',
      note: 'q3 (accepting) cannot be reached from q0, so it never appears in any DFA subset.',
      definition: { states: ['q0', 'q1', 'q2', 'q3'], alphabet: ['0', '1'], start: 'q0', accepting: ['q2', 'q3'],
        transitions: [t('q0', '0', 'q0', 'q1'), t('q0', '1', 'q0'), t('q1', '1', 'q2'), t('q3', '0', 'q3'), t('q3', '1', 'q2')] },
      tests: [yes('01'), no('10'), empty(false)] },
    { id: 'third-last', name: 'Worst-case growth: 3rd symbol from the end is 1',
      note: 'A 4-state NFA whose DFA needs 2^3 = 8 states (the DFA must remember the last 3 symbols).',
      definition: { states: ['q0', 'q1', 'q2', 'q3'], alphabet: ['0', '1'], start: 'q0', accepting: ['q3'],
        transitions: [t('q0', '0', 'q0'), t('q0', '1', 'q0', 'q1'), t('q1', '0', 'q2'), t('q1', '1', 'q2'), t('q2', '0', 'q3'), t('q2', '1', 'q3')] },
      tests: [yes('100'), no('011'), empty(false)] },
    { id: 'even-ab', name: 'Even number of a and even number of b',
      note: 'States remember (a parity, b parity): q0 = even/even (start, accepting), q1 = odd a, q2 = odd b, q3 = both odd. Already deterministic, so the DFA has the same 4 states.',
      definition: { states: ['q0', 'q1', 'q2', 'q3'], alphabet: ['a', 'b'], start: 'q0', accepting: ['q0'],
        transitions: [t('q0', 'a', 'q1'), t('q0', 'b', 'q2'), t('q1', 'a', 'q0'), t('q1', 'b', 'q3'),
          t('q2', 'a', 'q3'), t('q2', 'b', 'q0'), t('q3', 'a', 'q2'), t('q3', 'b', 'q1')] },
      tests: [yes('abab'), no('ab'), empty(true)] },
    { id: 'even-0', name: 'Even number of 0s',
      note: 'q0 = even number of 0s so far (start, accepting), q1 = odd. 1 never changes the parity. The empty string has zero 0s, so it is accepted.',
      definition: { states: ['q0', 'q1'], alphabet: ['0', '1'], start: 'q0', accepting: ['q0'],
        transitions: [t('q0', '0', 'q1'), t('q0', '1', 'q0'), t('q1', '0', 'q0'), t('q1', '1', 'q1')] },
      tests: [yes('1001'), no('10'), empty(true)] },
  ];
});
