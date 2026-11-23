/** app.js - user interface only. All automata logic lives in nfa-dfa.js (global NfaDfa). */
(function () {
  'use strict';
  const N = NfaDfa, fmt = N.formatSubset;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const verdict = b => (b ? '<span class="ok">Accepted</span>' : '<span class="bad">Rejected</span>');
  const presets = Examples.slice();
  const state = { nfa: null, dfa: null, preset: null, step: 0 };
  let edNames = [];

  // ---------- M1 example import (old format) ----------
  function fromLegacy(p) {
    const split = s => String(s).split(/[\s,]+/).filter(Boolean);
    return { id: 'm1-' + p.n, name: '★ ' + p.n, note: 'Imported M1 example.', tests: [], definition: {
      states: split(p.st), alphabet: split(p.al), start: String(p.s0).trim(), accepting: split(p.fin),
      transitions: p.tr.filter(r => r[0]).map(([f, a, t]) => ({ from: f.trim(), symbol: a.trim() === 'e' ? N.EPSILON : a.trim(), to: split(t) })) } };
  }
  try { JSON.parse(localStorage.getItem('as_saved') || '[]').forEach(p => presets.push(fromLegacy(p))); } catch (e) { /* no saved M1 examples */ }

  // ---------- load + convert ----------
  function loadDefinition(def, preset) {
    $('err').textContent = '';
    state.preset = preset;
    try { state.nfa = N.validateNfa(def); state.dfa = N.convertNfaToDfa(state.nfa); }
    catch (e) {
      if (!(e instanceof N.ValidationError || e instanceof N.LimitError)) throw e;
      state.nfa = state.dfa = null; $('results').hidden = true; $('err').textContent = e.message; renderChips(); return false;
    }
    $('results').hidden = false; $('bOut').innerHTML = '';
    state.step = state.dfa.trace.length;
    renderChips(); renderEditor(def); renderTestButtons(); renderDiagrams(); renderTables(); renderTrace(); renderHand();
    const first = preset && preset.tests && preset.tests[0];
    runString(first ? first.input : '', first ? first.expected : undefined);
    $('w').value = first ? first.input : '';
    return true;
  }
  function selectPreset(p) { loadDefinition(p.definition, p); }

  function renderChips() {
    $('chips').innerHTML = presets.map((p, i) => `<button class="${p === state.preset ? 'sel' : 'alt'}" data-i="${i}">${esc(p.name)}</button>`).join('');
    $('note').textContent = state.preset ? state.preset.note || '' : 'Custom NFA';
  }

  // ---------- string testing ----------
  function renderTestButtons() {
    const tests = (state.preset && state.preset.tests || []).slice();
    if (!tests.some(t => t.input === '')) tests.push({ label: 'ε (empty string)', input: '' });
    $('tbtn').innerHTML = tests.map((t, i) => `<button class="alt" data-t="${i}">${esc(t.label)}${t.expected === undefined ? '' : ' → expect ' + (t.expected ? 'Accept' : 'Reject')}</button>`).join('');
    $('tbtn').onclick = e => { const b = e.target.closest('button'); if (!b) return; const t = tests[+b.dataset.t]; $('w').value = t.input; runString(t.input, t.expected); };
  }

  function runString(text, expected) {
    let a, b;
    try { a = N.simulateNfa(state.nfa, text); b = N.simulateDfa(state.dfa, text); }
    catch (e) {
      if (!(e instanceof N.ValidationError)) throw e;
      $('runOut').innerHTML = `<p class="err">${esc(e.message)}</p><p class="hint">NFA and DFA report this same validation error; no verdict is given.</p>`; return;
    }
    const oracle = N.acceptsByPathSearch(state.nfa, [...text]);
    const exp = expected === undefined ? oracle : expected;
    const src = expected === undefined ? 'independent path-search checker' : 'preset';
    const ok = a.accepted === exp && b.accepted === exp;
    const rows = a.steps.map((s, i) => `<tr><td>${i}</td><td>${i ? esc(s.symbol) : 'ε (start)'}</td><td>${esc(fmt(s.set))}</td><td>${esc(state.dfa.states[b.steps[i].state].label)} = ${esc(fmt(state.dfa.states[b.steps[i].state].subset))}</td></tr>`).join('');
    $('runOut').innerHTML = `<div class="scroll"><table><tr><th>Step</th><th>Read</th><th>NFA: set of states</th><th>DFA: state = subset</th></tr>${rows}</table></div>
      <p>NFA: ${verdict(a.accepted)} · DFA: ${verdict(b.accepted)} · Expected (${src}): <b>${exp ? 'Accept' : 'Reject'}</b> ${ok ? '<span class="ok">✓ match</span>' : '<span class="bad">✗ MISMATCH</span>'}</p>
      <p class="hint">${esc(a.explanation)}<br>${esc(b.explanation)}</p>`;
  }

  // ---------- diagrams ----------
  function drawGraph(el, labels, edges, accepting, dead) {
    const n = labels.length, W = 720, H = n <= 3 ? 260 : n <= 8 ? 460 : 640, cx = W / 2, cy = H / 2, r = 26, R = n === 1 ? 0 : Math.min(W, H) / 2 - 70;
    let P = labels.map((_, i) => { const t = -Math.PI / 2 + 2 * Math.PI * i / n; return [cx + R * Math.cos(t), cy + R * Math.sin(t)]; });
    if (n === 2 || n === 3) P = labels.map((_, i) => [90 + i * (W - 180) / (n - 1), cy + (n === 3 && i === 1 ? -40 : 20)]);
    const unit = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="State diagram"><defs><marker id="ar${el.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink)"/></marker></defs>`;
    const arrow = `marker-end="url(#ar${el.id})"`;
    for (const key in edges) {
      const [i, j] = key.split('>').map(Number), text = esc([...new Set(edges[key])].join(',')), [x, y] = P[i];
      if (i === j) { s += `<path d="M${x - 10} ${y - r + 2}C${x - 34} ${y - r - 46} ${x + 34} ${y - r - 46} ${x + 10} ${y - r + 2}" fill="none" stroke="var(--ink)" ${arrow}/><text x="${x}" y="${y - r - 34}" text-anchor="middle" fill="var(--acc)" font-size="14" font-weight="700">${text}</text>`; continue; }
      const [x2, y2] = P[j], dx = x2 - x, dy = y2 - y, len = Math.hypot(dx, dy) || 1, off = edges[j + '>' + i] ? 34 : 14;
      const c = [(x + x2) / 2 - dy / len * off, (y + y2) / 2 + dx / len * off], u1 = unit(P[i], c), u2 = unit(P[j], c);
      const a = x + u1[0] * r, b = y + u1[1] * r, e = x2 + u2[0] * (r + 3), f = y2 + u2[1] * (r + 3);
      s += `<path d="M${a} ${b}Q${c[0]} ${c[1]} ${e} ${f}" fill="none" stroke="var(--ink)" ${arrow}/><text x="${(a + 2 * c[0] + e) / 4}" y="${(b + 2 * c[1] + f) / 4 - 4}" text-anchor="middle" fill="var(--acc)" font-size="14" font-weight="700">${text}</text>`;
    }
    P.forEach(([x, y], i) => {
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${i === 0 ? 'var(--hl)' : 'var(--panel)'}" stroke="var(--ink)" stroke-width="1.5" ${dead[i] ? 'stroke-dasharray="5 3"' : ''}/>`;
      if (accepting[i]) s += `<circle cx="${x}" cy="${y}" r="${r - 5}" fill="none" stroke="var(--ink)"/>`;
      s += `<text x="${x}" y="${y + 5}" text-anchor="middle" fill="var(--ink)" font-size="${labels[i].length > 2 ? 12 : 15}" font-weight="700">${esc(labels[i])}</text>`;
    });
    el.innerHTML = s + `<path d="M${P[0][0] - r - 34} ${P[0][1]}L${P[0][0] - r - 2} ${P[0][1]}" stroke="var(--ink)" ${arrow}/></svg>`;
  }
  function renderDiagrams() {
    const { nfa, dfa } = state, nfaEdges = {}, dfaEdges = {};
    nfa.delta.forEach((row, from) => row.forEach((targets, sym) => targets.forEach(to => {
      const k = nfa.index.get(from) + '>' + nfa.index.get(to); (nfaEdges[k] = nfaEdges[k] || []).push(sym);
    })));
    dfa.delta.forEach((row, i) => dfa.alphabet.forEach(a => { const k = i + '>' + row[a]; (dfaEdges[k] = dfaEdges[k] || []).push(a); }));
    drawGraph($('gn'), nfa.states, nfaEdges, nfa.states.map(q => nfa.accepting.has(q)), nfa.states.map(() => false));
    drawGraph($('gd'), dfa.states.map(s => s.label), dfaEdges, dfa.states.map(s => s.accepting), dfa.states.map(s => s.dead));
  }

  // ---------- tables ----------
  function renderTables() {
    const { nfa, dfa } = state, cols = nfa.alphabet.concat(nfa.hasEpsilon ? [N.EPSILON] : []);
    $('tn').innerHTML = '<table><tr><th>State</th>' + cols.map(c => `<th>on ${esc(c)}</th>`).join('') + '</tr>' +
      nfa.states.map(q => `<tr><td>${q === nfa.start ? '→ ' : ''}${nfa.accepting.has(q) ? '* ' : ''}${esc(q)}</td>` +
        cols.map(c => `<td>${esc(fmt(N.canonical(nfa, nfa.delta.get(q).get(c) || [])))}</td>`).join('') + '</tr>').join('') + '</table>';
    $('td').innerHTML = '<table><tr><th>DFA state</th><th>= NFA subset</th>' + dfa.alphabet.map(a => `<th>on ${esc(a)}</th>`).join('') + '<th>Accepting?</th></tr>' +
      dfa.states.map(s => `<tr><td>${s.id === 0 ? '→ ' : ''}${s.accepting ? '* ' : ''}${s.label}</td><td>${esc(fmt(s.subset))}${s.dead ? ' (dead)' : ''}</td>` +
        dfa.alphabet.map(a => `<td>${dfa.states[dfa.delta[s.id][a]].label}</td>`).join('') + `<td>${s.accepting ? 'Yes' : 'No'}</td></tr>`).join('') + '</table>' +
      `<p class="hint">${dfa.states.length} reachable subsets out of ${2 ** nfa.states.length} possible.</p>`;
  }

  // ---------- step-through trace ----------
  function renderTrace() {
    const { dfa } = state, shown = dfa.trace.slice(0, state.step), name = i => `${dfa.states[i].label} = ${fmt(dfa.states[i].subset)}`;
    $('tTable').innerHTML = '<table><tr><th>#</th><th>Current subset</th><th>Symbol</th><th>Union of NFA destinations</th><th>ε-closure</th><th>DFA state</th><th>New?</th></tr>' +
      shown.map((t, i) => {
        const cur = i === shown.length - 1 ? ' class="cur"' : '';
        return t.kind === 'start'
          ? `<tr${cur}><td>${i + 1}</td><td>start: {${esc(t.seed[0])}}</td><td>–</td><td>–</td><td>${esc(fmt(t.closure))}</td><td>${esc(name(t.to))}</td><td>new</td></tr>`
          : `<tr${cur}><td>${i + 1}</td><td>${esc(name(t.from))}</td><td>${esc(t.symbol)}</td><td>${esc(fmt(t.moved))}</td><td>${esc(fmt(t.closure))}</td><td>${esc(name(t.to))}</td><td>${t.isNew ? 'new' : 'seen before'}</td></tr>`;
      }).join('') + '</table>';
    const t = shown[shown.length - 1];
    if (!t) { $('tDetail').textContent = 'Press Next to start the construction.'; return; }
    $('tDetail').innerHTML = t.kind === 'start'
      ? `<b>Start state.</b> ε-closure({${esc(t.seed[0])}}) = ${esc(fmt(t.closure))}. This is DFA state ${dfa.states[t.to].label}; it joins the worklist.`
      : `<b>From ${esc(name(t.from))} on “${esc(t.symbol)}”:</b> ${t.parts.length ? t.parts.map(p => `δ(${esc(p.state)}, ${esc(t.symbol)}) = ${esc(fmt(p.targets))}`).join('; ') : 'the subset is empty, so nothing can move'}.
         Union = ${esc(fmt(t.moved))}. ε-closure = ${esc(fmt(t.closure))}${t.closure.length === t.moved.length ? ' (no new states from ε)' : ' (ε-moves added states)'}.
         ${t.isNew ? `New subset, so it becomes DFA state <b>${dfa.states[t.to].label}</b> and is added to the worklist.` : `Already discovered as DFA state <b>${dfa.states[t.to].label}</b>; no new state.`}`;
  }

  // ---------- hand-worked table check (Contains 01) ----------
  function renderHand() {
    const p = state.preset;
    $('hand').hidden = !(p && p.handTable);
    if ($('hand').hidden) return;
    const { nfa, dfa } = state, byKey = new Map(dfa.states.map(s => [N.subsetKey(s.subset), s]));
    let allOk = dfa.states.length === p.handTable.length;
    const rows = p.handTable.map(([S, acc, t]) => {
      const s = byKey.get(N.subsetKey(N.canonical(nfa, S)));
      const got = a => s ? fmt(dfa.states[dfa.delta[s.id][a]].subset) : 'missing';
      const ok = !!s && s.accepting === acc && dfa.alphabet.every(a => got(a) === fmt(N.canonical(nfa, t[a])));
      allOk = allOk && ok;
      return `<tr><td>${esc(fmt(S))}</td>` + dfa.alphabet.map(a => `<td>${esc(fmt(t[a]))} / ${esc(got(a))}</td>`).join('') + `<td>${acc ? 'Yes' : 'No'} / ${s ? (s.accepting ? 'Yes' : 'No') : '–'}</td><td>${ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>`;
    }).join('');
    $('handOut').innerHTML = `<p>Reachable subsets: expected ${p.handTable.length}, generated <b>${dfa.states.length}</b>. ∅ reachable: <b>${dfa.states.some(s => s.dead) ? 'yes' : 'no'}</b>. Overall: ${allOk ? '<span class="ok">matches the hand-worked table</span>' : '<span class="bad">DIFFERS</span>'}.</p>
      <table><tr><th>Subset</th>${dfa.alphabet.map(a => `<th>on ${esc(a)} (expected / generated)</th>`).join('')}<th>Accepting (exp / got)</th><th></th></tr>${rows}</table>
      <p class="hint">Why ∅ is unreachable: ${esc(p.noDeadNote || '')}</p>`;
  }

  // ---------- bounded check ----------
  function runBounded() {
    const len = Math.max(0, Math.min(12, parseInt($('ml').value, 10) || 0)), r = N.compareBounded(state.nfa, state.dfa, len);
    $('bOut').innerHTML = `<p>Requested length ${r.requestedLength}; fully tested up to length <b>${r.testedLength}</b> (${r.count} strings, ${r.accepted} accepted)${r.complete ? '' : ' — reduced to stay within the 20,000-string budget'}.
      ${r.mismatchCount ? `<span class="bad">${r.mismatchCount} mismatch(es), e.g. ${r.mismatches.map(esc).join(', ')}</span>` : '<span class="ok">No mismatches.</span>'}</p>
      <p class="hint">This is bounded testing, not a proof. Equivalence follows from the invariant: after any prefix, the DFA state equals the set of all NFA states reachable on that prefix (including ε-moves).</p>`;
  }

  // ---------- editor ----------
  function renderEditor(def) {
    edNames = def.states.slice();
    const eps = def.eps !== undefined ? def.eps : def.transitions.some(t => t.symbol === N.EPSILON), syms = [...new Set(def.alphabet)], cols = syms.concat(eps ? [N.EPSILON] : []);
    const targets = (f, s) => new Set(def.transitions.filter(t => t.from === f && t.symbol === s).flatMap(t => t.to));
    $('ed').innerHTML = `<div class="row"><div><label for="al">Alphabet (single characters, comma separated)</label><input id="al" value="${esc(def.alphabet.join(','))}"></div>
      <div><label for="st">Start state</label><select id="st">${edNames.map(q => `<option ${q === def.start ? 'selected' : ''}>${esc(q)}</option>`).join('')}</select></div></div>
      <label class="inl"><input type="checkbox" id="eps" ${eps ? 'checked' : ''}> Use ε column</label>
      <p>States: ${edNames.map(esc).join(', ')} <button class="alt" data-act="add">+ state</button><button class="alt" data-act="del">− state</button></p>
      <p>Accepting: ${edNames.map(q => `<label class="inl"><input type="checkbox" class="acc" value="${esc(q)}" ${def.accepting.includes(q) ? 'checked' : ''}> ${esc(q)}</label>`).join('')}</p>
      <div class="scroll"><table><tr><th>From \\ on</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>` +
      edNames.map(q => `<tr><td>${esc(q)}</td>` + cols.map(c => { const T = targets(q, c);
        return '<td>' + edNames.map(t => `<label class="inl"><input type="checkbox" class="cell" data-f="${esc(q)}" data-s="${esc(c)}" value="${esc(t)}" ${T.has(t) ? 'checked' : ''}> ${esc(t)}</label>`).join('') + '</td>'; }).join('') + '</tr>').join('') +
      '</table></div><p class="hint">Tick the target states for each cell. A blank cell means no transition.</p>';
  }
  function readEditor() {
    const groups = new Map();
    document.querySelectorAll('.cell:checked').forEach(c => {
      const key = c.dataset.f + '\u0000' + c.dataset.s;
      if (!groups.has(key)) groups.set(key, { from: c.dataset.f, symbol: c.dataset.s, to: [] });
      groups.get(key).to.push(c.value);
    });
    return { states: edNames.slice(), alphabet: $('al').value.split(/[\s,]+/).filter(Boolean), start: $('st').value,
      accepting: [...document.querySelectorAll('.acc:checked')].map(i => i.value), transitions: [...groups.values()], eps: $('eps').checked };
  }
  $('ed').onchange = e => { if (e.target.id === 'al' || e.target.id === 'eps') renderEditor(readEditor()); };
  $('ed').onclick = e => {
    const act = e.target.dataset && e.target.dataset.act; if (!act) return;
    const d = readEditor();
    if (act === 'add' && d.states.length < 10) { let i = d.states.length; while (d.states.includes('q' + i)) i++; d.states.push('q' + i); }
    if (act === 'del' && d.states.length > 1) {
      const gone = d.states.pop();
      d.transitions = d.transitions.filter(t => t.from !== gone).map(t => ({ ...t, to: t.to.filter(x => x !== gone) }));
      d.accepting = d.accepting.filter(x => x !== gone); if (d.start === gone) d.start = d.states[0];
    }
    renderEditor(d);
  };
  $('edGo').onclick = () => { const d = readEditor(); if (loadDefinition(d, null)) $('edMsg').textContent = 'Converted the custom NFA.'; else $('edMsg').textContent = ''; };
  $('edNew').onclick = () => renderEditor({ states: ['q0', 'q1'], alphabet: ['0', '1'], start: 'q0', accepting: [], transitions: [] });
  $('edReset').onclick = () => state.preset && selectPreset(state.preset);
  $('impGo').onclick = () => {
    try { const j = JSON.parse($('imp').value), p = fromLegacy(j); presets.push(p); selectPreset(p); $('edMsg').textContent = 'Imported.'; }
    catch (e) { $('edMsg').textContent = 'Import failed: ' + e.message; }
  };

  // ---------- wiring ----------
  $('chips').onclick = e => { const b = e.target.closest('button'); if (b) selectPreset(presets[+b.dataset.i]); };
  $('run').onclick = () => runString($('w').value);
  $('w').onkeydown = e => { if (e.key === 'Enter') runString($('w').value); };
  $('bc').onclick = runBounded;
  $('tNext').onclick = () => { state.step = Math.min(state.dfa.trace.length, state.step + 1); renderTrace(); };
  $('tPrev').onclick = () => { state.step = Math.max(0, state.step - 1); renderTrace(); };
  $('tAll').onclick = () => { state.step = state.dfa.trace.length; renderTrace(); };
  $('tNone').onclick = () => { state.step = 0; renderTrace(); };

  const rows = Tests.runAllTests(N, Examples), failed = rows.filter(r => !r.pass).length;
  $('testSum').innerHTML = `<p><b>${rows.length - failed} of ${rows.length}</b> tests passed in this browser run.</p>`;
  $('tests').innerHTML = '<table><tr><th>ID</th><th>Feature</th><th>Input</th><th>Expected</th><th>Actual</th><th>Result</th></tr>' +
    rows.map(r => `<tr class="${r.pass ? '' : 'fail'}"><td>${esc(r.id)}</td><td>${esc(r.feature)}</td><td>${esc(r.input)}</td><td>${esc(r.expected)}</td><td>${esc(r.actual)}</td><td>${r.pass ? '<span class="ok">PASS</span>' : '<span class="bad">FAIL</span>'}</td></tr>`).join('') + '</table>';

  selectPreset(presets[0]);   // opens with “Contains 01” loaded and converted
})();
