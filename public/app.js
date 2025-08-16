import {encodeShare} from './engine/share.js';
import {createBoard} from './board.js';
import {createKeyboard} from './keyboard.js';
import {createLetterStrip} from './letter-strip.js';
import {GUESS_BANDS, BAND_COLORS, getScoreForGuess, getBandForGuess} from './state.js';
import {createResultsModal} from './results.js';

const modeId = document.body.dataset.mode;
const module = await import(`./engine/${modeId}.js`);
const params = new URLSearchParams(location.search);
const daily = !params.has('practice');
const MAX_ATTEMPTS = GUESS_BANDS.reduce((a,b)=>a+b,0);
const attempts = daily ? MAX_ATTEMPTS : parseInt(params.get('attempts')||String(MAX_ATTEMPTS),10);
let game;
const mode = modeId;

const app = document.getElementById('app');
app.innerHTML = `
<header class="flex flex-col items-center gap-2 mb-4">
  <h1 class="text-2xl font-semibold">Sandwichle++</h1>
  <div id="countdown" class="text-sm opacity-75"></div>
  <div id="stats" class="text-sm"></div>
  <div id="score" class="text-sm"></div>
</header>
<main class="flex flex-col h-full">
  <div id="board" class="p-2 border-b border-gray-700"></div>
  <form id="composer" class="flex gap-2 p-2 border-b border-gray-700">
    <div id="guess" class="flex-1 p-2 rounded bg-gray-800 text-gray-100"></div>
    <button type="submit" class="px-4 py-2 rounded bg-green-500 text-gray-900 font-semibold">Guess</button>
  </form>
  <div id="letter-strip" class="p-2 border-b border-gray-700"></div>
  <div id="keyboard" class="flex flex-wrap gap-2 justify-center p-2 border-b border-gray-700"></div>
  <div id="feedback" class="text-center text-sm p-2"></div>
  <div id="attempts" class="text-center text-sm p-2">
    <div id="attempt-text" class="mb-1"></div>
    <div id="attempt-circles" class="flex justify-center flex-wrap gap-1"></div>
  </div>
</main>`;

const board = createBoard(document.getElementById('board'));
const feedbackEl = document.getElementById('feedback');
const attemptTextEl = document.getElementById('attempt-text');
const attemptCirclesEl = document.getElementById('attempt-circles');
const form = document.getElementById('composer');
const guessEl = document.getElementById('guess');
const submitBtn = form.querySelector('button');
const countdownEl = document.getElementById('countdown');
const statsEl = document.getElementById('stats');
const scoreEl = document.getElementById('score');
const headerEl = document.querySelector('header');
let categorySelect = null;
let streak = parseInt(localStorage.getItem('sandwichle-streak')||'0',10);
let trophies = parseInt(localStorage.getItem('sandwichle-trophies')||'0',10);
let currentGuess = '';
let gameOver = false;
let score = 0;
const letterStrip = createLetterStrip(document.getElementById('letter-strip'));
const keyboard = createKeyboard(document.getElementById('keyboard'), {
  onLetter: ch => {
    if (gameOver) return;
    if (currentGuess.length < 5) {
      clearError();
      currentGuess += ch.toLowerCase();
      guessEl.textContent = currentGuess.toUpperCase();
      keyboard.update(game.state, currentGuess);
    }
  },
  onBackspace: () => {
    if (gameOver) return;
    if (currentGuess.length) {
      clearError();
      currentGuess = currentGuess.slice(0, -1);
      guessEl.textContent = currentGuess.toUpperCase();
      keyboard.update(game.state, currentGuess);
    }
  },
  onEnter: () => {
    if (gameOver) return;
    submitGuess();
  }
});
const resultsModal = createResultsModal();

function showError(msg) {
  feedbackEl.textContent = msg;
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

function updateStats(){
  statsEl.textContent = `Streak: ${streak} 🏆${trophies}`;
}
updateStats();

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
  categorySelect.value = stored && manifest[stored] ? stored : 'icecream';
  localStorage.setItem('sandwichle-category', categorySelect.value);
  headerEl.appendChild(categorySelect);
}

async function startGame() {
  if (mode === 'words' && categorySelect) {
    game = await module.newGame({daily, attempts, category: categorySelect.value});
  } else {
    game = module.newGame({daily, attempts});
  }
  currentGuess = '';
  guessEl.textContent = '';
  gameOver = false;
  submitBtn.disabled = false;
  score = 0;
  scoreEl.textContent = `Score: ${score}/5`;
  render();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  submitGuess();
});

function submitGuess() {
  if (gameOver) return;
  const val = currentGuess.trim();
  if (val.length !== 5) return;
  const res = game.guess(val);
  if (res.error) {
    showError('Invalid guess');
    return;
  }
  const arrow = res.cmp < 0 ? '↑' : res.cmp > 0 ? '↓' : '';
  const lastGuess = res.state.guesses[res.state.guesses.length-1];
  lastGuess.arrow = arrow;
  lastGuess.win = res.win;
  lastGuess.distance = res.distance;
  clearError();
  currentGuess = '';
  guessEl.textContent = '';
  render();
  if (res.win) {
    gameOver = true;
    submitBtn.disabled = true;
    streak++;
    trophies++;
    localStorage.setItem('sandwichle-streak', streak);
    localStorage.setItem('sandwichle-trophies', trophies);
    updateStats();
    score = getScoreForGuess(game.state.guesses.length);
    scoreEl.textContent = `Score: ${score}/5`;
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
    submitBtn.disabled = true;
    streak = 0;
    localStorage.setItem('sandwichle-streak', streak);
    updateStats();
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

if (mode === 'words' && categorySelect) {
  categorySelect.addEventListener('change', () => {
    localStorage.setItem('sandwichle-category', categorySelect.value);
    startGame();
  });
}
await startGame();

function render() {
  const state = game.state;
  board.render(state);
  feedbackEl.classList.remove('text-red-500');
  delete feedbackEl.dataset.error;

  const last = state.guesses[state.guesses.length-1];
  if (last) {
    feedbackEl.textContent = `Distance: ${last.distance}% ${last.arrow || ''}`;
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

function updateCountdown(){
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1));
  const diff = next - now;
  const h = String(Math.floor(diff/3600000)).padStart(2,'0');
  const m = String(Math.floor(diff%3600000/60000)).padStart(2,'0');
  const s = String(Math.floor(diff%60000/1000)).padStart(2,'0');
  countdownEl.textContent = `Next puzzle in ${h}:${m}:${s}`;
}
setInterval(updateCountdown,1000);
updateCountdown();
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js'); }
