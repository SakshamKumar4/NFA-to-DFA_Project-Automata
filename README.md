# Automata Studio – NFA / ε-NFA to DFA (CSET302)
Group ID: `[GROUP-ID]` · Members: `[names and roll numbers]` · Faculty: `[name]`

## Overview
Converts an NFA (optionally with ε-transitions) into an equivalent DFA by subset construction, shows every step,
draws both automata, runs strings on both machines side by side, and checks the result with automated tests.

## Supported features
- Nine one-click presets: ordinary branching, reachable dead state, ε-chain with cycle, accepting start closure, unreachable state, worst-case growth, even a and even b, even number of 0s, and the M1 "Contains 01" example (loaded on start).
- Collapsible custom NFA editor: states, binary alphabet by default, start-state dropdown, accepting toggles, transition grid, optional ε column.
- Step-through trace: current subset → symbol → union of destinations → ε-closure → DFA state → new / seen before.
- NFA and DFA runs side by side (including step 0) with a plain-English reason for each verdict.
- Bounded equivalence check against an independent path-search checker, and an automated test table.

## Technology and dependencies
Plain HTML, CSS and JavaScript. **No dependencies, no build step, works offline.** Tests run on Node (written with v22). Page: any modern browser.

## How to run
- **Easiest (offline):** double-click `SourceCode/index.html`.
- Or, from `SourceCode/`: `python3 -m http.server 8000`, then open http://localhost:8000
- **Tests:** from `SourceCode/` run `node tests/run-tests.js` (or `npm test`). Exit code 0 = all passed.

## Project structure (entry point: `index.html`)
| File | Responsibility |
|---|---|
| `src/nfa-dfa.js` | All algorithms, no DOM: `validateNfa`, `epsilonClosure`, `move`, `convertNfaToDfa`, `simulateNfa`, `simulateDfa`, `acceptsByPathSearch`, `compareBounded` |
| `src/examples.js` | Preset automata and the hand-worked "Contains 01" table (data only) |
| `src/app.js` | User interface only |
| `tests/cases.js` | Test cases (shared by Node and the web page) |
| `tests/run-tests.js` | Node test runner |

## Example (definition format)
```json
{ "states":["q0","q1","q2"], "alphabet":["0","1"], "start":"q0", "accepting":["q2"],
  "transitions":[{"from":"q0","symbol":"0","to":["q0","q1"]},{"from":"q0","symbol":"1","to":["q0"]},{"from":"q1","symbol":"1","to":["q2"]}] }
```
Result: DFA states {q0}, {q0,q1}, {q0,q2}; input `1101` is accepted by both machines.

## Documented behaviour
- `ε` is the reserved ε-transition label (use the ε column in the editor). It cannot be an alphabet symbol.
- Alphabet symbols are unique single non-space characters. A **blank test string is ε**, the empty string.
- A string with a symbol outside the alphabet gives the same validation error from both simulators and no verdict.
- A missing transition means "no move". The DFA is complete: ∅ becomes a dead state only if reachable.
- Safety limit: 64 reachable subsets (the DFA can need up to 2^n). If exceeded, a message is shown and **no partial DFA is displayed**. Bounded-check budget: 20,000 strings, enforced before strings are generated.

## Known limitations and troubleshooting
- Editor allows up to 10 states; diagrams get crowded above about 10 DFA states (tables stay exact).
- No DFA minimization (out of scope).
- Blank page? Keep `src/` and `tests/` next to `index.html` and check the browser console.
- M1 examples: paste the M1 JSON into the editor import box (M1 used `e` for ε; it is converted).

## Team contributions and acknowledgements
`[member-wise tasks]` · Standard subset construction (e.g. Sipser, *Introduction to the Theory of Computation*). AI assistance was used for drafting; every member must be able to explain the code.
