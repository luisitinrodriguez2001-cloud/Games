// Word Association Game — CodePen-ready
// Uses: Datamuse API (clues), ConceptNet (semantic closeness), Free Dictionary (definitions), Random Word API (targets)
// All endpoints are public and require no API keys. Network failures gracefully degrade with fallbacks.

(() => {
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  const app = {
    mode: 'arcade',
    target: null,
    targetMeta: { pos: '—', defText: '—' },
    guesses: [],
    hints: [],
    revealedHints: 0,
    score: 0,
    startTime: null,
    timerId: null,
    timedDurationSec: 90,
    settings: {
      useConceptNet: true,
      useDictionary: true,
      useDatamuse: true,
      useRandomWord: true,
      strictValidation: false,
      colorBlind: false
    },
    stats: {
      games: 0, wins: 0, bestTimeMs: null, totalGuesses: 0,
      dailyStreak: 0, lastDaily: null
    },
    logRows: [], // for CSV download
  };

  // --- Utilities ---
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtPct = n => `${(n*100).toFixed(0)}%`;
  const nowISO = () => new Date().toISOString();
  const msToClock = ms => {
    if (ms == null) return '—';
    const s = Math.floor(ms/1000), m = Math.floor(s/60), r = s%60;
    return `${m}:${String(r).padStart(2,'0')}`;
  };
  const seededRandom = (seed) => { // xorshift32
    let x = seed|0 || 2463534242;
    return () => (x ^= x<<13, x ^= x>>>17, x ^= x<<5, ((x>>>0)/4294967296));
  };
  function download(filename, text, mime='text/plain') {
    const blob = new Blob([text], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function csvEscape(val){
    if(val == null) return '';
    const s = String(val).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }
  function toCSV(rows){
    if(!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const head = cols.join(',');
    const body = rows.map(r => cols.map(k => csvEscape(r[k])).join(',')).join('\n');
    return head + '\n' + body + '\n';
  }

  // --- API Clients ---
  async function fetchJSON(url, diagTag){
    const t0 = performance.now();
    try{
      const res = await fetch(url, {headers: {'Accept':'application/json'}});
      const txt = await res.text();
      const t1 = performance.now();
      diag(`${diagTag} ${res.status} ${Math.round(t1-t0)}ms — ${url}`);
      if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return JSON.parse(txt);
    }catch(err){
      diag(`${diagTag} ERR — ${err.message}`);
      throw err;
    }
  }

  // Datamuse: associations ("triggers") and synonyms
  async function datamuseAssociations(word){
    const url = `https://api.datamuse.com/words?rel_trg=${encodeURIComponent(word)}&max=20`;
    return fetchJSON(url, 'DM');
  }
  async function datamuseSynonyms(word){
    const url = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=20`;
    return fetchJSON(url, 'DM');
  }
  // ConceptNet relatedness 0..1
  async function conceptNetRelatedness(a, b){
    const url = `https://api.conceptnet.io/relatedness?node1=/c/en/${encodeURIComponent(a)}&node2=/c/en/${encodeURIComponent(b)}`;
    const j = await fetchJSON(url, 'CN');
    return j.value ?? 0;
  }
  // Free Dictionary definition
  async function freeDictDefinition(word){
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const j = await fetchJSON(url, 'FD');
    const entry = Array.isArray(j) ? j[0] : null;
    if(!entry) return {pos:'—', text:'—'};
    const meaningKey = entry.meanings && entry.meanings[0];
    const pos = meaningKey?.partOfSpeech ?? '—';
    const defs = meaningKey?.definitions?.slice(0,2)?.map(d => '• ' + d.definition)?.join('\n') ?? '—';
    return {pos, text: defs};
  }
  // Random target word (noun/adj preferred). Fallback: Datamuse pattern.
  async function randomWord(){
    try{
      const j = await fetchJSON('https://random-word-api.herokuapp.com/word?number=1', 'RW');
      if(Array.isArray(j) && j[0]) return sanitizeWord(j[0]);
    }catch{}
    // Fallback via Datamuse: pick random 5-8 letter common word
    const len = 5 + Math.floor(Math.random()*4);
    const pattern = '?'.repeat(len);
    try{
      const j = await fetchJSON(`https://api.datamuse.com/words?sp=${pattern}&max=1000&md=f`, 'DM');
      const pool = j.filter(w => (w.score ?? 0) > 10000 && /^[a-z]+$/.test(w.word));
      if(pool.length) return sanitizeWord(pool[Math.floor(Math.random()*pool.length)].word);
    }catch{}
    return 'planet';
  }

  function sanitizeWord(w){ return (w||'').toLowerCase().replace(/[^a-z]/g,''); }

  // --- Temperature mapping ---
  function tempLabel(x){
    if(x == null) return ['—', 0];
    if(x >= 0.50) return ['🔥 Blazing', 100];
    if(x >= 0.40) return ['🌶️ Hot', 80];
    if(x >= 0.30) return ['🌤️ Warm', 60];
    if(x >= 0.20) return ['🧊 Cool', 40];
    if(x >= 0.10) return ['❄️ Cold', 25];
    return ['🧊 Freezing', 10];
  }

  // --- Rendering ---
  function render(){
    qs('#modeMeta').textContent = app.mode[0].toUpperCase()+app.mode.slice(1);
    qs('#guessesMeta').textContent = app.guesses.length;
    qs('#hintsMeta').textContent = app.revealedHints;
    qs('#scoreMeta').textContent = app.score;
    qs('#posMeta').textContent = app.targetMeta.pos || '—';
    qs('#definition').textContent = app.targetMeta.defText || '—';
    qs('#roundTitle').textContent = app.target ? 'Guess the secret word' : 'New Round';
    qs('#targetMeta').textContent = app.target ? `Secret word is ${app.target.length} letters` : '';
    // guesses list
    const list = qs('#guessList');
    list.innerHTML = '';
    app.guesses.forEach(g => {
      const el = document.createElement('div');
      el.className = 'guess';
      el.innerHTML = `<span class="badge">${g.word}</span>
                      <span class="muted">rel:</span> <span>${g.rel?.toFixed(3) ?? '—'}</span>
                      <span class="score">+${g.delta ?? 0}</span>`;
      list.appendChild(el);
    });
    // clues
    const cluesEl = qs('#clues');
    cluesEl.innerHTML = '';
    app.hints.forEach((h, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip ' + (i >= app.revealedHints ? 'hidden' : '');
      chip.textContent = h;
      cluesEl.appendChild(chip);
    });
    // stats
    const s = app.stats;
    qs('#gamesPlayed').textContent = s.games;
    const wr = s.games ? Math.round(100 * (s.wins/s.games)) : 0;
    qs('#winRate').textContent = wr + '%';
    qs('#dailyStreak').textContent = s.dailyStreak || 0;
    qs('#bestTime').textContent = s.bestTimeMs ? msToClock(s.bestTimeMs) : '—';
    qs('#avgGuesses').textContent = s.totalGuesses ? (s.totalGuesses/s.games).toFixed(1) : '—';
    // thermo is handled per-guess
    document.documentElement.setAttribute('color-blind', app.settings.colorBlind ? '1' : '0');
  }

  function setThermo(rel){
    const [label, pct] = tempLabel(rel);
    qs('#thermoText').textContent = label;
    qs('#thermoFill').style.width = pct + '%';
  }

  function diag(msg){
    const el = qs('#apiDiag');
    const time = new Date().toLocaleTimeString();
    el.textContent = `[${time}] ${msg}\n` + el.textContent.slice(0, 1400);
  }

  // --- Core game flow ---
  async function startRound(mode='arcade', targetOverride=null){
    app.mode = mode;
    app.guesses = [];
    app.revealedHints = 0;
    app.score = 0;
    app.target = null;
    app.targetMeta = { pos: '—', defText: '—' };
    setThermo(null);
    qs('#timerMeta').textContent = mode === 'timed' ? `${app.timedDurationSec}s` : '—';
    render();

    let target = targetOverride;
    if(!target){
      if(app.settings.useRandomWord){
        target = await randomWord();
      }else{
        target = 'planet';
      }
    }
    app.target = sanitizeWord(target);

    // load hints/definition in parallel
    const tasks = [];
    if(app.settings.useDatamuse) tasks.push(datamuseAssociations(app.target).catch(()=>[]));
    else tasks.push(Promise.resolve([]));
    if(app.settings.useDictionary) tasks.push(freeDictDefinition(app.target).catch(()=>({pos:'—', text:'—'})));
    else tasks.push(Promise.resolve({pos:'—', text:'—'}));

    const [assoc, def] = await Promise.all(tasks);
    app.hints = (assoc || []).map(o => o.word).filter(w => w !== app.target).slice(0, 12);
    app.targetMeta = { pos: def.pos, defText: def.text };

    // daily seed
    if(mode === 'daily'){
      const d = new Date();
      const seed = parseInt(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`);
      // shuffle hints deterministically
      const rnd = seededRandom(seed ^ (app.target.charCodeAt(0)||17));
      app.hints = app.hints.sort(() => rnd() - 0.5);
    }

    // timer for Timed mode
    if(mode === 'timed'){
      const endTs = Date.now() + app.timedDurationSec*1000;
      clearInterval(app.timerId);
      app.timerId = setInterval(() => {
        const left = Math.max(0, endTs - Date.now());
        qs('#timerMeta').textContent = msToClock(left);
        if(left === 0){
          clearInterval(app.timerId);
          finishRound(false, 'Time up!');
        }
      }, 200);
    }else{
      clearInterval(app.timerId);
      qs('#timerMeta').textContent = '—';
    }

    app.startTime = performance.now();
    app.logRows = [];
    app.logRows.push({ts: nowISO(), event:'start', mode: app.mode, target: app.target});

    // auto-reveal first hint
    revealHint();
    render();
    qs('#status').textContent = 'Started! Guess the word.';
  }

  function revealHint(){
    if(app.revealedHints < app.hints.length){
      app.revealedHints++;
      app.score = Math.max(0, app.score - 2);
      render();
    }
  }

  async function validateWord(word){
    if(!app.settings.strictValidation) return true;
    try {
      await freeDictDefinition(word);
      return true;
    } catch {
      return false;
    }
  }

  async function onGuess(){
    const input = qs('#guessInput');
    const raw = input.value.trim().toLowerCase();
    input.value = '';
    if(!raw) return;

    if(!/^[a-z][a-z'-]*$/.test(raw)){
      qs('#status').textContent = 'Please enter a valid word.';
      return;
    }
    const word = sanitizeWord(raw);
    if(word === app.target){
      const rel = 1;
      app.guesses.push({word, rel, delta: 20});
      app.score += 20;
      setThermo(rel);
      render();
      await finishRound(true, 'Perfect! You nailed it.');
      return;
    }
    if(app.guesses.some(g => g.word === word)){
      qs('#status').textContent = 'You already tried that.';
      return;
    }

    // validation (optional)
    const ok = await validateWord(word);
    if(!ok){
      qs('#status').textContent = 'Not a recognized word (strict mode).';
      return;
    }

    let rel = 0;
    if(app.settings.useConceptNet){
      try { rel = await conceptNetRelatedness(word, app.target); }
      catch { rel = 0; }
    } else {
      // fallback: letter overlap
      const setA = new Set(word), setB = new Set(app.target);
      const inter = [...setA].filter(x => setB.has(x)).length;
      rel = inter / Math.max(setB.size, 1) * 0.25; // cap low
    }
    setThermo(rel);

    // scoring
    const delta = Math.round(Math.max(1, rel * 10) - app.revealedHints);
    app.score += delta;
    app.guesses.push({word, rel, delta});
    app.logRows.push({ts: nowISO(), event:'guess', word, rel, delta});

    // auto-reveal an extra hint if very cold
    if(rel < 0.10 && app.revealedHints < app.hints.length){
      revealHint();
      qs('#status').textContent = 'Cold. Revealed another hint.';
    } else {
      qs('#status').textContent = rel >= 0.30 ? 'Getting warmer…' : 'Keep exploring.';
    }
    qs('#guessesMeta').textContent = app.guesses.length;
    render();
  }

  async function finishRound(win, message){
    clearInterval(app.timerId);
    const tookMs = Math.max(1, (performance.now() - (app.startTime || performance.now())));
    qs('#status').textContent = `${message} The word was “${app.target}”.`;
    app.stats.games++;
    if(win) app.stats.wins++;
    app.stats.totalGuesses += app.guesses.length;
    if(win && (app.stats.bestTimeMs == null || tookMs < app.stats.bestTimeMs)){
      app.stats.bestTimeMs = tookMs;
    }
    if(app.mode === 'daily'){
      const today = new Date().toISOString().slice(0,10);
      if(app.stats.lastDaily !== today && win){
        app.stats.dailyStreak = (app.stats.lastDaily === dayMinus1(today)) ? (app.stats.dailyStreak + 1) : 1;
        app.stats.lastDaily = today;
      } else if (app.stats.lastDaily !== today && !win){
        app.stats.dailyStreak = 0;
        app.stats.lastDaily = today;
      }
    }
    saveState();
    render();
    app.logRows.push({ts: nowISO(), event:'finish', win, took_ms: Math.round(tookMs), score: app.score});
  }

  function dayMinus1(iso){
    const d = new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()-1);
    return d.toISOString().slice(0,10);
  }

  // --- State persistence ---
  function saveState(){
    try{
      localStorage.setItem('wag_settings', JSON.stringify(app.settings));
      localStorage.setItem('wag_stats', JSON.stringify(app.stats));
    }catch{}
  }
  function loadState(){
    try{
      Object.assign(app.settings, JSON.parse(localStorage.getItem('wag_settings')||'{}'));
      Object.assign(app.stats, JSON.parse(localStorage.getItem('wag_stats')||'{}'));
    }catch{}
  }

  // --- Event wiring ---
  function wire(){
    // mode tabs
    qsa('.mode-tabs .tab').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        qsa('.mode-tabs .tab').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const mode = e.currentTarget.dataset.mode;
        await startRound(mode);
      });
    });

    // guess input
    qs('#guessInput').addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); onGuess(); }
    });
    qs('#guessBtn').addEventListener('click', onGuess);

    // actions
    qs('#hintBtn').addEventListener('click', () => { revealHint(); qs('#status').textContent='Hint revealed.'; });
    qs('#revealBtn').addEventListener('click', () => finishRound(false, 'Revealed.'));
    qs('#newRoundBtn').addEventListener('click', () => startRound(app.mode));
    qs('#shareBtn').addEventListener('click', async () => {
      const text = `Word Association — I ${app.guesses.some(g => g.word===app.target)?'guessed':'tried'} “${app.target}” in ${app.guesses.length} guesses. Score ${app.score}.`;
      try{
        if(navigator.share){
          await navigator.share({text, url: location.href});
        }else{
          await navigator.clipboard.writeText(text);
          qs('#status').textContent = 'Copied to clipboard.';
        }
      }catch{}
    });
    qs('#downloadBtn').addEventListener('click', () => {
      const csv = toCSV(app.logRows);
      download(`word-association-log-${Date.now()}.csv`, csv, 'text/csv');
    });

    // settings
    const dlg = qs('#settingsDialog');
    qs('#settingsBtn').addEventListener('click', () => dlg.showModal());
    qs('#resetStatsBtn').addEventListener('click', (e) => {
      e.preventDefault();
      app.stats = {games:0, wins:0, bestTimeMs:null, totalGuesses:0, dailyStreak:0, lastDaily:null};
      saveState(); render();
    });
    const bindCheck = (id, key) => qs(id).addEventListener('change', e => { app.settings[key] = e.target.checked; saveState(); });
    bindCheck('#toggleConceptNet','useConceptNet');
    bindCheck('#toggleDictionary','useDictionary');
    bindCheck('#toggleDatamuse','useDatamuse');
    bindCheck('#toggleRandomWord','useRandomWord');
    bindCheck('#toggleStrictValidation','strictValidation');
    bindCheck('#toggleColorBlind','colorBlind');
  }

  // --- Boot ---
  function init(){
    loadState();
    // sync toggles
    qs('#toggleConceptNet').checked = app.settings.useConceptNet;
    qs('#toggleDictionary').checked = app.settings.useDictionary;
    qs('#toggleDatamuse').checked = app.settings.useDatamuse;
    qs('#toggleRandomWord').checked = app.settings.useRandomWord;
    qs('#toggleStrictValidation').checked = app.settings.strictValidation;
    qs('#toggleColorBlind').checked = app.settings.colorBlind;

    wire();
    startRound('arcade');
  }

  window.addEventListener('DOMContentLoaded', init);
})();