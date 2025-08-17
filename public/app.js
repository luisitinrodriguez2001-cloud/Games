import {encodeShare} from './engine/share.js';
import {createBoard} from './board.js';
import {createKeyboard} from './keyboard.js';
import {createLetterStrip} from './letter-strip.js';
import {GUESS_BANDS, BAND_COLORS, getBandForGuess} from './state.js';
import {createResultsModal} from './results.js';

const modeId = document.body.dataset.mode;
const module = await import(`./engine/${modeId}.js`);
const params = new URLSearchParams(location.search);
const daily = !params.has('practice');
const DEFAULT_MAX_ATTEMPTS = GUESS_BANDS.reduce((a,b)=>a+b,0);
let attempts;
let game;
const mode = modeId;

const app = document.getElementById('app');
app.innerHTML = `
<header class="flex flex-col items-center gap-2 mb-4">
  <h1 class="text-2xl font-semibold">Sandwichle++</h1>
  <div id="attempts" class="text-center text-sm">
    <div id="attempt-text" class="mb-1"></div>
    <div id="attempt-circles" class="flex justify-center flex-wrap gap-1"></div>
  </div>
</header>
<main class="flex flex-col h-full">
  <div id="board" class="p-2 border-b border-gray-700"></div>
  <div id="letter-strip" class="p-2 border-b border-gray-700"></div>
  <div id="keyboard" class="flex flex-wrap gap-2 justify-center p-2 border-b border-gray-700"></div>
  <div id="feedback" class="text-center text-sm p-2"></div>
  <div id="controls" class="flex flex-col gap-2 p-2"></div>
</main>`;

const board = createBoard(document.getElementById('board'));
const feedbackEl = document.getElementById('feedback');
const attemptTextEl = document.getElementById('attempt-text');
const attemptCirclesEl = document.getElementById('attempt-circles');
const headerEl = document.querySelector('header');
const controlsEl = document.getElementById('controls');
let categorySelect = null;
let streak = parseInt(localStorage.getItem('sandwichle-streak')||'0',10);
let trophies = parseInt(localStorage.getItem('sandwichle-trophies')||'0',10);
let currentGuess = '';
let gameOver = false;
const letterStrip = createLetterStrip(document.getElementById('letter-strip'));
const keyboard = createKeyboard(document.getElementById('keyboard'), {
  onLetter: ch => {
    if (gameOver) return;
    if (currentGuess.length < 5) {
      clearError();
      // ch is already lowercase from the keyboard component
      currentGuess += ch;
      board.render(game.state, currentGuess);
      keyboard.update(game.state, currentGuess);
    }
  },
  onBackspace: () => {
    if (gameOver) return;
    if (currentGuess.length) {
      clearError();
      currentGuess = currentGuess.slice(0, -1);
      board.render(game.state, currentGuess);
      keyboard.update(game.state, currentGuess);
    }
  },
  onEnter: () => {
    if (gameOver) return;
    submitGuess();
  }
});
const resultsModal = createResultsModal();

function showError(msg, guess) {
  feedbackEl.textContent = '';
  const span = document.createElement('span');
  span.textContent = msg;
  feedbackEl.appendChild(span);
  if (guess) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '?';
    btn.className = 'ml-2 underline';
    btn.addEventListener('click', () => {
      if (confirm('Do you believe this word is in the category and should be added?')) {
        addWordToCategory(guess);
        const res = game.guess(guess);
        handleResult(res);
      }
    });
    feedbackEl.appendChild(btn);
  }
  feedbackEl.classList.add('text-red-500');
  feedbackEl.dataset.error = '1';
}

function clearError() {
  if (feedbackEl.dataset.error) {
    feedbackEl.textContent = '';
    feedbackEl.classList.remove('text-red-500');
    delete feedbackEl.dataset.error;
  }
}

function saveHistory(win, guesses) {
  const history = JSON.parse(localStorage.getItem('sandwichle-history') || '[]');
  history.push({win, guesses});
  localStorage.setItem('sandwichle-history', JSON.stringify(history));
}

function addWordToCategory(word) {
  const cat = categorySelect ? categorySelect.value : 'general';
  const key = `sandwichle-custom-${cat}`;
  const stored = JSON.parse(localStorage.getItem(key) || '[]');
  if (!stored.includes(word)) {
    stored.push(word);
    localStorage.setItem(key, JSON.stringify(stored));
  }
  const list = game.state.list;
  let idx = list.findIndex(w => w > word);
  if (idx === -1) idx = list.length;
  list.splice(idx, 0, word);
  if (idx <= game.state.targetIdx) game.state.targetIdx++;
  if (idx <= game.state.top) game.state.top++;
  if (idx <= game.state.bottom) game.state.bottom++;
  game.state.guesses.forEach(g => { if (idx <= g.idx) g.idx++; });
}

function handleResult(res) {
  const arrow = res.cmp < 0 ? '↑' : res.cmp > 0 ? '↓' : '';
  const lastGuess = res.state.guesses[res.state.guesses.length-1];
  lastGuess.arrow = arrow;
  lastGuess.win = res.win;
  clearError();
  currentGuess = '';
  render();
  if (res.win) {
    gameOver = true;
    streak++;
    trophies += module.trophyReward ?? 1;
    localStorage.setItem('sandwichle-streak', streak);
    localStorage.setItem('sandwichle-trophies', trophies);
    render();
    saveHistory(true, game.state.guesses.length);
    const share = encodeShare(game.state.guesses, game.state.targetIdx);
    resultsModal.show({
      win: true,
      target: game.state.target,
      trophies,
      guessesUsed: game.state.guesses.length,
      streak,
      share
    });
  } else if (res.lose) {
    gameOver = true;
    streak = 0;
    localStorage.setItem('sandwichle-streak', streak);
    render();
    saveHistory(false, game.state.guesses.length);
    const share = encodeShare(game.state.guesses, game.state.targetIdx);
    resultsModal.show({
      win: false,
      target: game.state.target,
      trophies,
      guessesUsed: game.state.guesses.length,
      streak,
      share
    });
  }
}


if (mode === 'words' && module.loadManifest) {
  const manifest = await module.loadManifest();
  categorySelect = document.createElement('select');
  categorySelect.className = 'w-full p-2 rounded bg-gray-800 text-gray-100';
  Object.entries(manifest).forEach(([slug, info]) => {
    const opt = document.createElement('option');
    opt.value = slug;
    opt.textContent = info.name;
    categorySelect.appendChild(opt);
  });
  const stored = localStorage.getItem('sandwichle-category');
  const defaultCat = Object.keys(manifest)[0];
  categorySelect.value = stored && manifest[stored] ? stored : defaultCat;
  localStorage.setItem('sandwichle-category', categorySelect.value);
  headerEl.appendChild(categorySelect);
}

const newWordBtn = document.createElement('button');
newWordBtn.textContent = 'New Word';
newWordBtn.className = 'w-full p-2 rounded bg-blue-600 text-white';
newWordBtn.addEventListener('click', () => startGame());
controlsEl.appendChild(newWordBtn);

const hintBtn = document.createElement('button');
hintBtn.textContent = 'Hint';
hintBtn.className = 'w-full p-2 rounded bg-yellow-500 text-gray-900';
let hintLevel = 0;
hintBtn.addEventListener('click', async () => {
  if (!game || !game.state?.target) return;
  const target = game.state.target;
  try {
    if (hintLevel === 0) {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${target}`);
      const data = await res.json();
      const definition = data[0]?.meanings?.[0]?.definitions?.[0]?.definition;
      alert(
        definition
          ? `Definition: ${definition}\n(Note: definition may refer to a different sense of the word.)`
          : 'No definition found.'
      );
    } else if (hintLevel === 1) {
      const res = await fetch(`https://api.datamuse.com/words?rel_syn=${target}&max=5`);
      const data = await res.json();
      const syns = data.map(w => w.word).filter(Boolean);
      alert(
        syns.length
          ? `Synonyms: ${syns.slice(0,3).join(', ')}\n(Note: synonyms may refer to a different sense of the word.)`
          : 'No synonyms found.'
      );
    }
    hintLevel = (hintLevel + 1) % 2;
  } catch (err) {
    alert('Error fetching hint.');
  }
});
controlsEl.appendChild(hintBtn);

const revealLetterBtn = document.createElement('button');
revealLetterBtn.textContent = 'Reveal Letter';
revealLetterBtn.className = 'w-full p-2 rounded bg-purple-500 text-gray-900';
let revealedLetters = 0;
revealLetterBtn.addEventListener('click', () => {
  if (!game || !game.state?.target) return;
  const target = game.state.target.toUpperCase();
  if (revealedLetters < target.length) {
    revealedLetters++;
    alert(`Revealed letters: ${target.slice(0, revealedLetters)}`);
  } else {
    alert('All letters revealed.');
  }
});
controlsEl.appendChild(revealLetterBtn);

async function startGame() {
  if (mode === 'words' && categorySelect) {
    game = await module.newGame({daily, category: categorySelect.value});
  } else {
    const max = daily ? DEFAULT_MAX_ATTEMPTS : parseInt(params.get('attempts')||String(DEFAULT_MAX_ATTEMPTS),10);
    game = await module.newGame({daily, attempts: max});
  }
  attempts = game.state.guesses.length + game.state.attemptsLeft;
  currentGuess = '';
  gameOver = false;
  hintLevel = 0;
  revealedLetters = 0;
  render();
}
function submitGuess() {
  if (gameOver) return;
  const val = currentGuess.trim();
  if (val.length !== 5) return;
  const res = game.guess(val);
  if (res.error) {
    if (mode === 'words') {
      showError('This word is not in this category', val);
    } else {
      showError('Invalid guess');
    }
    return;
  }
  handleResult(res);
}

if (mode === 'words' && categorySelect) {
  categorySelect.addEventListener('change', () => {
    localStorage.setItem('sandwichle-category', categorySelect.value);
    startGame();
  });
}
await startGame();

function render() {
  const state = game.state;
  board.render(state, currentGuess);
  feedbackEl.classList.remove('text-red-500');
  delete feedbackEl.dataset.error;

  const last = state.guesses[state.guesses.length-1];
  if (last) {
    feedbackEl.textContent = `Index: ${last.idx+1} ${last.arrow || ''}`;
  } else {
    feedbackEl.textContent = '';
  }

  const used = state.guesses.length;
  const nextGuess = gameOver ? used : used + 1;
  attemptTextEl.textContent = `Guess ${nextGuess}/${attempts}`;
  attemptCirclesEl.innerHTML = '';
  for (let i = 0; i < attempts; i++) {
    const circle = document.createElement('span');
    circle.className = `w-3 h-3 rounded-full ${i < used ? 'bg-gray-700' : BAND_COLORS[getBandForGuess(i+1)]}`;
    attemptCirclesEl.appendChild(circle);
  }
  letterStrip.update(state);
  keyboard.update(state, currentGuess);
}
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js'); }
