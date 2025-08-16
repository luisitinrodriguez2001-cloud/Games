import {encodeShare} from './engine/share.js';

const modeId = document.body.dataset.mode;
const module = await import(`./engine/${modeId}.js`);
const params = new URLSearchParams(location.search);
const daily = !params.has('practice');
const attempts = daily ? 14 : parseInt(params.get('attempts')||'14',10);
const game = module.newGame({daily, attempts});
const mode = modeId;

const app = document.getElementById('app');
app.innerHTML = `
<header>
  <h1>Betweenle++</h1>
  <div id="countdown"></div>
</header>
<main>
  <div id="log" role="log" aria-live="polite"></div>
  <form id="composer">
    <input aria-label="Guess" autocomplete="off" />
    <button type="submit">Guess</button>
  </form>
</main>`;

const log = document.getElementById('log');
const form = document.getElementById('composer');
const input = form.querySelector('input');
const countdownEl = document.getElementById('countdown');

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
    alert('Win!\n'+encodeShare(game.state.guesses, game.state.targetIdx));
  } else if (res.lose) {
    alert('Lose! Target was '+game.state.target);
  }
});

function render() {
  const state = game.state;
  log.innerHTML='';
  const items = [
    {label: state.list[state.top], info:'', cls:'guess-row bound'}
  ];
  state.guesses.forEach((g,i)=>{
    const arrow = g.idx < state.targetIdx ? '↑' : g.idx > state.targetIdx ? '↓' : '🎯';
    items.push({label: state.list[g.idx], info:`${g.distance}% ${arrow}`, cls:'guess-row'+(i===state.closestIdx?' closest':'')});
  });
  items.push({label: state.list[state.bottom], info:'', cls:'guess-row bound'});
  items.forEach(it=>{
    const row = document.createElement('div');
    row.className = it.cls;
    row.innerHTML = `<span>${it.label}</span><span>${it.info}</span>`;
    log.appendChild(row);
  });
  log.lastElementChild?.scrollIntoView({behavior:'smooth', block:'end'});
}
render();

function updateCountdown(){
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1));
  const diff = next - now;
  const h = String(Math.floor(diff/3600000)).padStart(2,'0');
  const m = String(Math.floor(diff%3600000/60000)).padStart(2,'0');
  const s = String(Math.floor(diff%60000/1000)).padStart(2,'0');
  countdownEl.textContent = `${h}:${m}:${s}`;
}
setInterval(updateCountdown,1000);
updateCountdown();
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js'); }
