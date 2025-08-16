import {encodeShare} from './engine/share.js';

const modeId = document.body.dataset.mode;
const module = await import(`./engine/${modeId}.js`);
const params = new URLSearchParams(location.search);
const daily = !params.has('practice');
const attempts = daily ? 14 : parseInt(params.get('attempts')||'14',10);
let game;
const mode = modeId;

const app = document.getElementById('app');
app.innerHTML = `
<header class="flex flex-col items-center gap-2 mb-4">
  <h1 class="text-2xl font-semibold">Sandwichle++</h1>
  <div id="countdown" class="text-sm opacity-75"></div>
  <div id="stats" class="text-sm"></div>
</header>
<main class="flex flex-col h-full">
  <div id="top" class="text-center p-2 border-b border-gray-700"></div>
  <form id="composer" class="flex gap-2 p-2 border-b border-gray-700">
    <input aria-label="Guess" autocomplete="off" class="flex-1 p-2 rounded bg-gray-800 text-gray-100" />
    <button type="submit" class="px-4 py-2 rounded bg-green-500 text-gray-900 font-semibold">Guess</button>
  </form>
  <div id="bottom" class="text-center p-2 border-b border-gray-700"></div>
  <div id="feedback" class="text-center text-sm p-2"></div>
  <div id="attempts" class="text-center text-sm p-2"></div>
</main>`;

const topEl = document.getElementById('top');
const bottomEl = document.getElementById('bottom');
const feedbackEl = document.getElementById('feedback');
const attemptsEl = document.getElementById('attempts');
const form = document.getElementById('composer');
const input = form.querySelector('input');
const countdownEl = document.getElementById('countdown');
const statsEl = document.getElementById('stats');
const headerEl = document.querySelector('header');
let categorySelect = null;
let streak = parseInt(localStorage.getItem('sandwichle-streak')||'0',10);

function updateStats(){
  statsEl.textContent = `Streak: ${streak}`;
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
  render();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const val = input.value.trim();
  if (!val) return;
  const res = game.guess(val);
  if (res.error) {
    alert('Invalid guess');
    return;
  }
  render();
  input.value='';
  if (res.win) {
    streak++;
    localStorage.setItem('sandwichle-streak', streak);
    updateStats();
    const share = encodeShare(game.state.guesses, game.state.targetIdx);
    navigator.clipboard?.writeText(share).catch(()=>{});
    alert('Win!\n'+share);
  } else if (res.lose) {
    streak = 0;
    localStorage.setItem('sandwichle-streak', streak);
    updateStats();
    alert('Lose! Target was '+game.state.target);
  }
});

if (mode === 'words' && categorySelect) {
  categorySelect.addEventListener('change', () => {
    localStorage.setItem('sandwichle-category', categorySelect.value);
    startGame();
  });
}
await startGame();

function render() {
  const state = game.state;
  topEl.textContent = state.list[state.top];
  bottomEl.textContent = state.list[state.bottom];

  const last = state.guesses[state.guesses.length-1];
  if (last) {
    const arrow = last.idx < state.targetIdx ? '↑' : last.idx > state.targetIdx ? '↓' : '🎯';
    feedbackEl.textContent = `Index: ${last.idx} ${arrow}`;
  } else {
    feedbackEl.textContent = '';
  }

  const used = attempts - state.attemptsLeft;
  attemptsEl.textContent = `Guesses: ${used}/${attempts}`;
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
