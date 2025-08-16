// Word Association Game — CodePen-ready
// Uses: Datamuse API (clues), ConceptNet (semantic closeness), Free Dictionary (definitions), and a local common word list for targets
// All endpoints are public and require no API keys. Network failures gracefully degrade with fallbacks.

(() => {
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));
  const dom = {};
  const app = {
    mode: "arcade",
    target: null,
    targetMeta: { pos: "—", defText: "—" },
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
      colorBlind: false,
    },
    stats: {
      games: 0,
      wins: 0,
      bestTimeMs: null,
      totalGuesses: 0,
      dailyStreak: 0,
      lastDaily: null,
    },
    logRows: [], // for CSV download
  };

  // --- Utilities ---
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtPct = (n) => `${(n * 100).toFixed(0)}%`;
  const nowISO = () => new Date().toISOString();
  const msToClock = (ms) => {
    if (ms == null) return "—";
    const s = Math.floor(ms / 1000),
      m = Math.floor(s / 60),
      r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };
  const seededRandom = (seed) => {
    // xorshift32
    let x = seed | 0 || 2463534242;
    return () => (
      (x ^= x << 13),
      (x ^= x >>> 17),
      (x ^= x << 5),
      (x >>> 0) / 4294967296
    );
  };
  function download(filename, text, mime = "text/plain") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function csvEscape(val) {
    if (val == null) return "";
    const s = String(val).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }
  function toCSV(rows) {
    if (!rows.length) return "";
    const cols = Object.keys(rows[0]);
    const head = cols.join(",");
    const body = rows
      .map((r) => cols.map((k) => csvEscape(r[k])).join(","))
      .join("\n");
    return head + "\n" + body + "\n";
  }

  // --- API Clients ---
  async function fetchJSON(url, diagTag) {
    const t0 = performance.now();
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const txt = await res.text();
      const t1 = performance.now();
      diag(`${diagTag} ${res.status} ${Math.round(t1 - t0)}ms — ${url}`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return JSON.parse(txt);
    } catch (err) {
      diag(`${diagTag} ERR — ${err.message}`);
      throw err;
    }
  }

  // Datamuse: associations ("triggers") and synonyms
  async function datamuseAssociations(word) {
    const url = `https://api.datamuse.com/words?rel_trg=${encodeURIComponent(word)}&max=20&md=p`;
    const j = await fetchJSON(url, "DM");
    return j.filter((w) => (w.tags || []).includes("n"));
  }
  async function datamuseSynonyms(word) {
    const url = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=20&md=p`;
    const j = await fetchJSON(url, "DM");
    return j.filter((w) => (w.tags || []).includes("n"));
  }
  // ConceptNet relatedness 0..1
  async function conceptNetRelatedness(a, b) {
    const url = `https://api.conceptnet.io/relatedness?node1=/c/en/${encodeURIComponent(a)}&node2=/c/en/${encodeURIComponent(b)}`;
    const j = await fetchJSON(url, "CN");
    return j.value ?? 0;
  }
  // Free Dictionary definition
  async function freeDictDefinition(word) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const j = await fetchJSON(url, "FD");
    const entry = Array.isArray(j) ? j[0] : null;
    if (!entry) return { pos: "—", text: "—", isNoun: false };
    const meanings = entry.meanings || [];
    const meaningKey = meanings[0];
    const pos = meaningKey?.partOfSpeech ?? "—";
    const defs =
      meaningKey?.definitions
        ?.slice(0, 2)
        ?.map((d) => "• " + d.definition)
        ?.join("\n") ?? "—";
    const isNoun = meanings.some((m) => m.partOfSpeech === "noun");
    return { pos, text: defs, isNoun };
  }
  const nounCache = {};
  async function isNoun(word) {
    if (nounCache[word] != null) return nounCache[word];
    try {
      const { isNoun } = await freeDictDefinition(word);
      nounCache[word] = isNoun;
      return isNoun;
    } catch {
      nounCache[word] = false;
      return false;
    }
  }
  // Random target word (noun only). Fallback: Datamuse pattern.
  let commonWordPool = null;
  async function loadCommonWords() {
    if (commonWordPool) return commonWordPool;
    try {
      const res = await fetch("common_words.txt");
      const txt = await res.text();
      commonWordPool = txt
        .split(/\r?\n/)
        .map((w) => sanitizeWord(w))
        .filter((w) => w.length >= 4 && w.length <= 8);
    } catch {
      commonWordPool = [];
    }
    return commonWordPool;
  }
  async function randomWord() {
    const pool = await loadCommonWords();
    if (pool.length) {
      for (let i = 0; i < 20; i++) {
        const w = pool[Math.floor(Math.random() * pool.length)];
        if (await isNoun(w)) return w;
      }
    }
    // Fallback via Datamuse: pick random 4-6 letter common noun
    const len = 4 + Math.floor(Math.random() * 3);
    const pattern = "?".repeat(len);
    try {
      const j = await fetchJSON(
        `https://api.datamuse.com/words?sp=${pattern}&max=1000&md=p,f`,
        "DM",
      );
      const pool2 = j.filter(
        (w) =>
          (w.score ?? 0) > 20000 &&
          /^[a-z]+$/.test(w.word) &&
          (w.tags || []).includes("n"),
      );
      if (pool2.length)
        return sanitizeWord(pool2[Math.floor(Math.random() * pool2.length)].word);
    } catch {}
    return "planet";
  }

  function sanitizeWord(w) {
    return (w || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  // --- Temperature mapping ---
  function tempLabel(x) {
    if (x == null) return ["—", 0];
    if (x >= 0.5) return ["🔥 Blazing", 100];
    if (x >= 0.4) return ["🌶️ Hot", 80];
    if (x >= 0.3) return ["🌤️ Warm", 60];
    if (x >= 0.2) return ["🧊 Cool", 40];
    if (x >= 0.1) return ["❄️ Cold", 25];
    return ["🧊 Freezing", 10];
  }

  // --- Rendering ---
  function render() {
    dom.modeMeta.textContent = app.mode[0].toUpperCase() + app.mode.slice(1);
    dom.guessesMeta.textContent = app.guesses.length;
    dom.hintsMeta.textContent = app.revealedHints;
    dom.scoreMeta.textContent = app.score;
    dom.posMeta.textContent = app.targetMeta.pos || "—";
    dom.definition.textContent = app.targetMeta.defText || "—";
    dom.roundTitle.textContent = app.target
      ? "Guess the secret word"
      : "New Round";
    dom.targetMeta.textContent = app.target
      ? `Secret word is ${app.target.length} letters`
      : "";
    // guesses list
    const frag = document.createDocumentFragment();
    app.guesses.forEach((g) => {
      const el = document.createElement("div");
      el.className = "guess";
      el.innerHTML = `<span class="badge">${g.word}</span>
                      <span class="muted">rel:</span> <span>${g.rel?.toFixed(3) ?? "—"}</span>
                      <span class="score">+${g.delta ?? 0}</span>`;
      frag.appendChild(el);
    });
    dom.guessList.innerHTML = "";
    dom.guessList.appendChild(frag);
    // clues
    const cfrag = document.createDocumentFragment();
    app.hints.forEach((h, i) => {
      const chip = document.createElement("span");
      chip.className = "chip " + (i >= app.revealedHints ? "hidden" : "");
      chip.textContent = h;
      cfrag.appendChild(chip);
    });
    dom.clues.innerHTML = "";
    dom.clues.appendChild(cfrag);
    // stats
    const s = app.stats;
    dom.gamesPlayed.textContent = s.games;
    const wr = s.games ? Math.round(100 * (s.wins / s.games)) : 0;
    dom.winRate.textContent = wr + "%";
    dom.dailyStreak.textContent = s.dailyStreak || 0;
    dom.bestTime.textContent = s.bestTimeMs ? msToClock(s.bestTimeMs) : "—";
    dom.avgGuesses.textContent = s.totalGuesses
      ? (s.totalGuesses / s.games).toFixed(1)
      : "—";
    document.documentElement.setAttribute(
      "color-blind",
      app.settings.colorBlind ? "1" : "0",
    );
  }

  function setThermo(rel) {
    const [label, pct] = tempLabel(rel);
    dom.thermoText.textContent = label;
    dom.thermoFill.style.width = pct + "%";
  }

  function diag(msg) {
    const time = new Date().toLocaleTimeString();
    dom.apiDiag.textContent =
      `[${time}] ${msg}\n` + dom.apiDiag.textContent.slice(0, 1400);
  }

  // --- Core game flow ---
  async function startRound(mode = "arcade", targetOverride = null) {
    app.mode = mode;
    app.guesses = [];
    app.revealedHints = 0;
    app.score = 0;
    app.target = null;
    app.targetMeta = { pos: "—", defText: "—" };
    setThermo(null);
    dom.timerMeta.textContent =
      mode === "timed" ? `${app.timedDurationSec}s` : "—";
    render();

    let target = targetOverride;
    if (!target) {
      if (app.settings.useRandomWord) {
        target = await randomWord();
      } else {
        target = "planet";
      }
    }
    app.target = sanitizeWord(target);

    // load hints/definition in parallel
    const tasks = [];
    if (app.settings.useDatamuse)
      tasks.push(datamuseAssociations(app.target).catch(() => []));
    else tasks.push(Promise.resolve([]));
    if (app.settings.useDictionary)
      tasks.push(
        freeDictDefinition(app.target).catch(() => ({ pos: "—", text: "—" })),
      );
    else tasks.push(Promise.resolve({ pos: "—", text: "—" }));

    const [assoc, def] = await Promise.all(tasks);
    app.hints = (assoc || [])
      .map((o) => o.word)
      .filter((w) => w !== app.target)
      .slice(0, 12);
    app.targetMeta = { pos: def.pos, defText: def.text };

    // daily seed
    if (mode === "daily") {
      const d = new Date();
      const seed = parseInt(
        `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`,
      );
      // shuffle hints deterministically
      const rnd = seededRandom(seed ^ (app.target.charCodeAt(0) || 17));
      app.hints = app.hints.sort(() => rnd() - 0.5);
    }

    // timer for Timed mode
    if (mode === "timed") {
      const endTs = Date.now() + app.timedDurationSec * 1000;
      clearInterval(app.timerId);
      app.timerId = setInterval(() => {
        const left = Math.max(0, endTs - Date.now());
        dom.timerMeta.textContent = msToClock(left);
        if (left === 0) {
          clearInterval(app.timerId);
          finishRound(false, "Time up!");
        }
      }, 200);
    } else {
      clearInterval(app.timerId);
      dom.timerMeta.textContent = "—";
    }

    app.startTime = performance.now();
    app.logRows = [];
    app.logRows.push({
      ts: nowISO(),
      event: "start",
      mode: app.mode,
      target: app.target,
    });

    // auto-reveal first hint
    revealHint();
    render();
    dom.status.textContent = "Started! Guess the word.";
  }

  function revealHint() {
    if (app.revealedHints < app.hints.length) {
      app.revealedHints++;
      app.score = Math.max(0, app.score - 2);
      render();
    }
  }

  async function validateWord(word) {
    return await isNoun(word);
  }

  async function onGuess() {
    const input = dom.guessInput;
    const raw = input.value.trim().toLowerCase();
    input.value = "";
    if (!raw) return;

    if (!/^[a-z][a-z'-]*$/.test(raw)) {
      dom.status.textContent = "Please enter a valid word.";
      return;
    }
    const word = sanitizeWord(raw);
    if (word === app.target) {
      const rel = 1;
      app.guesses.push({ word, rel, delta: 20 });
      app.score += 20;
      setThermo(rel);
      render();
      await finishRound(true, "Perfect! You nailed it.");
      return;
    }
    if (app.guesses.some((g) => g.word === word)) {
      dom.status.textContent = "You already tried that.";
      return;
    }

    const ok = await validateWord(word);
    if (!ok) {
      dom.status.textContent = "Please enter a noun.";
      return;
    }

    let rel = 0;
    if (app.settings.useConceptNet) {
      try {
        rel = await conceptNetRelatedness(word, app.target);
      } catch {
        rel = 0;
      }
    } else {
      // fallback: letter overlap
      const setA = new Set(word),
        setB = new Set(app.target);
      const inter = [...setA].filter((x) => setB.has(x)).length;
      rel = (inter / Math.max(setB.size, 1)) * 0.25; // cap low
    }
    setThermo(rel);

    // scoring
    const delta = Math.round(Math.max(1, rel * 10) - app.revealedHints);
    app.score += delta;
    app.guesses.push({ word, rel, delta });
    app.logRows.push({ ts: nowISO(), event: "guess", word, rel, delta });

    // auto-reveal an extra hint if very cold
    if (rel < 0.1 && app.revealedHints < app.hints.length) {
      revealHint();
      dom.status.textContent = "Cold. Revealed another hint.";
    } else {
      dom.status.textContent =
        rel >= 0.3 ? "Getting warmer…" : "Keep exploring.";
    }
    dom.guessesMeta.textContent = app.guesses.length;
    render();
  }

  async function finishRound(win, message) {
    clearInterval(app.timerId);
    const tookMs = Math.max(
      1,
      performance.now() - (app.startTime || performance.now()),
    );
    dom.status.textContent = `${message} The word was “${app.target}”.`;
    app.stats.games++;
    if (win) app.stats.wins++;
    app.stats.totalGuesses += app.guesses.length;
    if (
      win &&
      (app.stats.bestTimeMs == null || tookMs < app.stats.bestTimeMs)
    ) {
      app.stats.bestTimeMs = tookMs;
    }
    if (app.mode === "daily") {
      const today = new Date().toISOString().slice(0, 10);
      if (app.stats.lastDaily !== today && win) {
        app.stats.dailyStreak =
          app.stats.lastDaily === dayMinus1(today)
            ? app.stats.dailyStreak + 1
            : 1;
        app.stats.lastDaily = today;
      } else if (app.stats.lastDaily !== today && !win) {
        app.stats.dailyStreak = 0;
        app.stats.lastDaily = today;
      }
    }
    saveState();
    render();
    app.logRows.push({
      ts: nowISO(),
      event: "finish",
      win,
      took_ms: Math.round(tookMs),
      score: app.score,
    });
  }

  function dayMinus1(iso) {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  // --- State persistence ---
  function saveState() {
    try {
      localStorage.setItem("wag_settings", JSON.stringify(app.settings));
      localStorage.setItem("wag_stats", JSON.stringify(app.stats));
    } catch {}
  }
  function loadState() {
    try {
      Object.assign(
        app.settings,
        JSON.parse(localStorage.getItem("wag_settings") || "{}"),
      );
      Object.assign(
        app.stats,
        JSON.parse(localStorage.getItem("wag_stats") || "{}"),
      );
    } catch {}
  }

  // --- Event wiring ---
  function wire() {
    // mode tabs
    qsa(".mode-tabs .tab").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        qsa(".mode-tabs .tab").forEach((b) => b.classList.remove("active"));
        e.currentTarget.classList.add("active");
        const mode = e.currentTarget.dataset.mode;
        await startRound(mode);
      });
    });

    // guess input
    dom.guessInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onGuess();
      }
    });
    dom.guessBtn.addEventListener("click", onGuess);

    // actions
    dom.hintBtn.addEventListener("click", () => {
      revealHint();
      dom.status.textContent = "Hint revealed.";
    });
    dom.revealBtn.addEventListener("click", () =>
      finishRound(false, "Revealed."),
    );
    dom.newRoundBtn.addEventListener("click", () => startRound(app.mode));
    dom.shareBtn.addEventListener("click", async () => {
      const text = `Word Association — I ${app.guesses.some((g) => g.word === app.target) ? "guessed" : "tried"} “${app.target}” in ${app.guesses.length} guesses. Score ${app.score}.`;
      try {
        if (navigator.share) {
          await navigator.share({ text, url: location.href });
        } else {
          await navigator.clipboard.writeText(text);
          dom.status.textContent = "Copied to clipboard.";
        }
      } catch {}
    });
    dom.downloadBtn.addEventListener("click", () => {
      const csv = toCSV(app.logRows);
      download(`word-association-log-${Date.now()}.csv`, csv, "text/csv");
    });

    // settings
    const dlg = dom.settingsDialog;
    dom.settingsBtn.addEventListener("click", () => dlg.showModal());
    dom.resetStatsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      app.stats = {
        games: 0,
        wins: 0,
        bestTimeMs: null,
        totalGuesses: 0,
        dailyStreak: 0,
        lastDaily: null,
      };
      saveState();
      render();
    });
    const bindCheck = (el, key) =>
      el.addEventListener("change", (e) => {
        app.settings[key] = e.target.checked;
        saveState();
      });
    bindCheck(dom.toggleConceptNet, "useConceptNet");
    bindCheck(dom.toggleDictionary, "useDictionary");
    bindCheck(dom.toggleDatamuse, "useDatamuse");
    bindCheck(dom.toggleRandomWord, "useRandomWord");
    bindCheck(dom.toggleStrictValidation, "strictValidation");
    bindCheck(dom.toggleColorBlind, "colorBlind");
  }

  // --- Boot ---
  function init() {
    loadState();
    Object.assign(dom, {
      modeMeta: qs("#modeMeta"),
      guessesMeta: qs("#guessesMeta"),
      hintsMeta: qs("#hintsMeta"),
      scoreMeta: qs("#scoreMeta"),
      posMeta: qs("#posMeta"),
      definition: qs("#definition"),
      roundTitle: qs("#roundTitle"),
      targetMeta: qs("#targetMeta"),
      guessList: qs("#guessList"),
      clues: qs("#clues"),
      gamesPlayed: qs("#gamesPlayed"),
      winRate: qs("#winRate"),
      dailyStreak: qs("#dailyStreak"),
      bestTime: qs("#bestTime"),
      avgGuesses: qs("#avgGuesses"),
      thermoText: qs("#thermoText"),
      thermoFill: qs("#thermoFill"),
      apiDiag: qs("#apiDiag"),
      guessInput: qs("#guessInput"),
      guessBtn: qs("#guessBtn"),
      hintBtn: qs("#hintBtn"),
      revealBtn: qs("#revealBtn"),
      newRoundBtn: qs("#newRoundBtn"),
      shareBtn: qs("#shareBtn"),
      downloadBtn: qs("#downloadBtn"),
      settingsBtn: qs("#settingsBtn"),
      timerMeta: qs("#timerMeta"),
      status: qs("#status"),
      settingsDialog: qs("#settingsDialog"),
      resetStatsBtn: qs("#resetStatsBtn"),
      toggleConceptNet: qs("#toggleConceptNet"),
      toggleDictionary: qs("#toggleDictionary"),
      toggleDatamuse: qs("#toggleDatamuse"),
      toggleRandomWord: qs("#toggleRandomWord"),
      toggleStrictValidation: qs("#toggleStrictValidation"),
      toggleColorBlind: qs("#toggleColorBlind"),
    });

    // sync toggles
    dom.toggleConceptNet.checked = app.settings.useConceptNet;
    dom.toggleDictionary.checked = app.settings.useDictionary;
    dom.toggleDatamuse.checked = app.settings.useDatamuse;
    dom.toggleRandomWord.checked = app.settings.useRandomWord;
    dom.toggleStrictValidation.checked = app.settings.strictValidation;
    dom.toggleColorBlind.checked = app.settings.colorBlind;

    wire();
    startRound("arcade");
  }

  window.addEventListener("DOMContentLoaded", init);
})();
