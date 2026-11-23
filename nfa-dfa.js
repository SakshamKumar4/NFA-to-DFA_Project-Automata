/**
 * nfa-dfa.js - pure algorithms for NFA / ε-NFA -> DFA subset construction.
 * No DOM code. Works in the browser (global `NfaDfa`) and in Node (require).
 *
 * NFA definition (plain JSON):
 *   { states:['q0','q1'], alphabet:['0','1'], start:'q0', accepting:['q1'],
 *     transitions:[ {from:'q0', symbol:'0', to:['q0','q1']}, ... ] }
 *  - 'ε' is the reserved label of an ε-transition; it cannot be an alphabet symbol.
 *  - Several rows for the same (from, symbol) are merged by set union.
 *  - A missing transition means "no move" (the empty set).
 * Input strings: one character = one symbol. A BLANK string is ε (the empty string).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NfaDfa = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EPSILON = 'ε';
  const DEFAULT_LIMITS = { maxDfaStates: 64 };

  /** Bad automaton or bad input string. `errors` lists every problem found. */
  class ValidationError extends Error {
    constructor(errors) { super(errors.join('\n')); this.name = 'ValidationError'; this.errors = errors; }
  }
  /** A safety limit was hit (the DFA can have up to 2^n states). */
  class LimitError extends Error {
    constructor(message) { super(message); this.name = 'LimitError'; }
  }

  // ---------- subsets: canonical representation ----------
  // A subset is an array of state names sorted by the order the states were declared.
  // The same set found in a different order therefore gives the same array and the same key.

  /** @returns {string[]} sorted, duplicate-free copy of `states` */
  function canonical(nfa, states) {
    return [...new Set(states)].sort((a, b) => nfa.index.get(a) - nfa.index.get(b));
  }
  /** Unique string for a canonical subset, used as the Map key of a DFA state. */
  function subsetKey(subset) { return JSON.stringify(subset); }
  function formatSubset(subset) { return subset.length ? '{' + subset.join(', ') + '}' : '∅'; }

  // ---------- validation ----------
  /**
   * Check an NFA definition and build the lookup structure used everywhere else.
   * @throws {ValidationError} listing all problems
   * @returns {{states, alphabet, start, accepting:Set, delta:Map, index:Map, hasEpsilon:boolean}}
   *          delta.get(state).get(symbol) is a Set of target states.
   */
  function validateNfa(def) {
    def = def || {};
    const errors = [];
    const states = Array.isArray(def.states) ? def.states : [];
    const alphabet = Array.isArray(def.alphabet) ? def.alphabet : [];
    const accepting = Array.isArray(def.accepting) ? def.accepting : [];
    const transitions = Array.isArray(def.transitions) ? def.transitions : [];

    if (!states.length) errors.push('Add at least one state.');
    states.forEach(s => { if (typeof s !== 'string' || !s.trim()) errors.push(`Invalid state name ${JSON.stringify(s)}.`); });
    if (new Set(states).size !== states.length) errors.push('State names must be unique.');

    if (!alphabet.length) errors.push('The alphabet needs at least one symbol.');
    const seen = new Set();
    alphabet.forEach(a => {
      if (typeof a !== 'string' || [...a].length !== 1 || /\s/.test(a)) errors.push(`Invalid alphabet symbol ${JSON.stringify(a)}: use exactly one non-space character.`);
      else if (a === EPSILON) errors.push(`"${EPSILON}" is reserved for ε-transitions and cannot be an alphabet symbol.`);
      else if (seen.has(a)) errors.push(`Duplicate alphabet symbol "${a}".`);
      seen.add(a);
    });

    const known = new Set(states);
    if (!known.has(def.start)) errors.push(`Start state ${JSON.stringify(def.start)} is not in the state list.`);
    accepting.forEach(q => { if (!known.has(q)) errors.push(`Accepting state "${q}" is not in the state list.`); });

    transitions.forEach((t, i) => {
      const where = `Transition ${i + 1}`;
      if (!known.has(t.from)) errors.push(`${where}: unknown source state "${t.from}".`);
      if (t.symbol !== EPSILON && !seen.has(t.symbol)) errors.push(`${where}: symbol "${t.symbol}" is not in the alphabet (use ${EPSILON} for ε).`);
      (t.to || []).forEach(q => { if (!known.has(q)) errors.push(`${where}: unknown target state "${q}".`); });
    });
    if (errors.length) throw new ValidationError(errors);

    const delta = new Map(states.map(s => [s, new Map()]));
    for (const t of transitions) {
      const row = delta.get(t.from);
      if (!row.has(t.symbol)) row.set(t.symbol, new Set());
      t.to.forEach(q => row.get(t.symbol).add(q));          // repeated rows = set union
    }
    return {
      states: [...states], alphabet: [...alphabet], start: def.start,
      accepting: new Set(accepting), delta,
      index: new Map(states.map((s, i) => [s, i])),
      hasEpsilon: transitions.some(t => t.symbol === EPSILON && t.to.length > 0),
    };
  }

  // ---------- the two core operations ----------
  /**
   * ε-closure: every state reachable from `subset` using only ε-transitions (including `subset`).
   * The `visited` set makes ε-cycles terminate. Without ε-transitions it returns the input set.
   */
  function epsilonClosure(nfa, subset) {
    const visited = new Set(subset);
    const stack = [...visited];
    while (stack.length) {
      const q = stack.pop();
      for (const next of nfa.delta.get(q).get(EPSILON) || []) {
        if (!visited.has(next)) { visited.add(next); stack.push(next); }
      }
    }
    return canonical(nfa, visited);
  }

  /** move(S, a): union of δ(q, a) over every q in S. Does NOT take the ε-closure. */
  function move(nfa, subset, symbol) {
    if (!nfa.alphabet.includes(symbol)) throw new ValidationError([`Symbol "${symbol}" is not in the alphabet.`]);
    const targets = [];
    for (const q of subset) targets.push(...(nfa.delta.get(q).get(symbol) || []));
    return canonical(nfa, targets);
  }

  // ---------- subset construction ----------
  /**
   * Convert an NFA (validated by validateNfa) to an equivalent DFA.
   * Worklist = the `states` array itself: states are appended when discovered and processed
   * in order, so exactly the reachable subsets are built, each once.
   * @throws {LimitError} if more than `maxDfaStates` subsets are reachable (no partial DFA is returned)
   * @returns {{alphabet, start:0, states:[{id,label,subset,accepting,dead}], delta:Object[], trace:Object[]}}
   *          delta[i][symbol] = id of the target DFA state.
   */
  function convertNfaToDfa(nfa, limits) {
    const { maxDfaStates } = Object.assign({}, DEFAULT_LIMITS, limits);
    const states = [], delta = [], trace = [], byKey = new Map();
    const labelOf = i => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '');

    function discover(subset) {
      const key = subsetKey(subset);
      if (byKey.has(key)) return { id: byKey.get(key), isNew: false };
      if (states.length >= maxDfaStates) {
        throw new LimitError(`Stopped: more than ${maxDfaStates} reachable subsets (the DFA can need up to 2^${nfa.states.length} = ${2 ** nfa.states.length} states). The DFA is NOT complete, so none is shown.`);
      }
      const id = states.length;
      byKey.set(key, id);
      states.push({ id, label: labelOf(id), subset, accepting: subset.some(q => nfa.accepting.has(q)), dead: subset.length === 0 });
      delta.push({});
      return { id, isNew: true };
    }

    const seed = [nfa.start];
    const startSubset = epsilonClosure(nfa, seed);
    trace.push({ kind: 'start', seed, closure: startSubset, to: discover(startSubset).id, isNew: true });

    for (let next = 0; next < states.length; next++) {           // worklist loop
      const S = states[next].subset;
      for (const a of nfa.alphabet) {
        const parts = S.map(q => ({ state: q, targets: canonical(nfa, nfa.delta.get(q).get(a) || []) }));
        const moved = move(nfa, S, a);
        const closure = epsilonClosure(nfa, moved);
        const found = discover(closure);
        delta[next][a] = found.id;
        trace.push({ kind: 'move', from: next, symbol: a, parts, moved, closure, to: found.id, isNew: found.isNew });
      }
    }
    return { alphabet: [...nfa.alphabet], start: 0, states, delta, trace };
  }

  // ---------- running strings ----------
  /** Split text into symbols; blank text = ε. Same error for both simulators. */
  function parseInputString(alphabet, text) {
    const symbols = [...(text || '')];
    const bad = symbols.findIndex(c => !alphabet.includes(c));
    if (bad >= 0) throw new ValidationError([`Symbol "${symbols[bad]}" at position ${bad + 1} is not in the alphabet {${alphabet.join(', ')}}.`]);
    return symbols;
  }

  /** Run the NFA directly, tracking the set of possible states (ε-closure after every move). */
  function simulateNfa(nfa, text) {
    const symbols = parseInputString(nfa.alphabet, text);
    let current = epsilonClosure(nfa, [nfa.start]);
    const steps = [{ step: 0, symbol: null, set: current }];
    symbols.forEach((a, i) => {
      const moved = move(nfa, current, a);
      current = epsilonClosure(nfa, moved);
      steps.push({ step: i + 1, symbol: a, moved, set: current });
    });
    const hit = current.filter(q => nfa.accepting.has(q));
    const accepted = hit.length > 0;
    const explanation = accepted
      ? `Accepted: the final set ${formatSubset(current)} contains accepting state ${hit.join(', ')}.`
      : `Rejected: the final set ${formatSubset(current)} contains no accepting state (accepting = ${formatSubset([...nfa.accepting])}).`;
    return { accepted, steps, explanation };
  }

  /** Run the generated DFA (one state per step). */
  function simulateDfa(dfa, text) {
    const symbols = parseInputString(dfa.alphabet, text);
    let cur = dfa.start;
    const steps = [{ step: 0, symbol: null, state: cur }];
    symbols.forEach((a, i) => { cur = dfa.delta[cur][a]; steps.push({ step: i + 1, symbol: a, state: cur }); });
    const s = dfa.states[cur];
    const explanation = s.accepting
      ? `Accepted: DFA state ${s.label} = ${formatSubset(s.subset)} contains an accepting NFA state.`
      : `Rejected: DFA state ${s.label} = ${formatSubset(s.subset)} ${s.dead ? 'is the dead state (no NFA path survives).' : 'contains no accepting NFA state.'}`;
    return { accepted: s.accepting, steps, explanation };
  }

  /**
   * Independent acceptance oracle for testing. Searches (state, input position) pairs with a
   * visited set, following ε-edges without consuming input. It never builds a DFA.
   */
  function acceptsByPathSearch(nfa, symbols) {
    const visited = new Set();
    const stack = [[nfa.start, 0]];
    while (stack.length) {
      const [q, pos] = stack.pop();
      const key = nfa.index.get(q) + ':' + pos;
      if (visited.has(key)) continue;
      visited.add(key);
      if (pos === symbols.length && nfa.accepting.has(q)) return true;
      for (const t of nfa.delta.get(q).get(EPSILON) || []) stack.push([t, pos]);
      if (pos < symbols.length) for (const t of nfa.delta.get(q).get(symbols[pos]) || []) stack.push([t, pos + 1]);
    }
    return false;
  }

  /**
   * Bounded comparison of the DFA with the oracle on ALL strings up to some length.
   * The budget is checked BEFORE a length is generated, so at most `budget` strings are built.
   * This is testing, not a proof of equivalence.
   */
  function compareBounded(nfa, dfa, requestedLength, budget = 20000) {
    let tested = -1, total = 0, count = 1;
    for (let len = 0; len <= requestedLength && total + count <= budget; len++) {
      total += count; tested = len; count *= nfa.alphabet.length;
    }
    let level = [[]], accepted = 0, tests = 0;
    const mismatches = [];
    for (let len = 0; len <= tested; len++) {
      for (const w of level) {
        tests++;
        const expected = acceptsByPathSearch(nfa, w);
        if (expected) accepted++;
        if (simulateDfa(dfa, w.join('')).accepted !== expected) mismatches.push(w.join('') || 'ε');
      }
      if (len < tested) level = level.flatMap(w => nfa.alphabet.map(a => [...w, a]));
    }
    return { requestedLength, testedLength: tested, count: tests, accepted, mismatches: mismatches.slice(0, 5), mismatchCount: mismatches.length, complete: tested === requestedLength };
  }

  return { EPSILON, DEFAULT_LIMITS, ValidationError, LimitError, canonical, subsetKey, formatSubset,
           validateNfa, epsilonClosure, move, convertNfaToDfa, parseInputString,
           simulateNfa, simulateDfa, acceptsByPathSearch, compareBounded };
});
