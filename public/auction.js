const weightInputs = [
  { key: 'pts', label: 'Points', default: 1 },
  { key: 'tpm', label: '3PM', default: 1 },
  { key: 'fga', label: 'FGA', default: -1 },
  { key: 'fgm', label: 'FGM', default: 2 },
  { key: 'fta', label: 'FTA', default: -1 },
  { key: 'ftm', label: 'FTM', default: 1 },
  { key: 'reb', label: 'Rebounds', default: 1 },
  { key: 'ast', label: 'Assists', default: 2 },
  { key: 'stl', label: 'Steals', default: 4 },
  { key: 'blk', label: 'Blocks', default: 4 },
  { key: 'to', label: 'Turnovers', default: -2 },
];

const weightsDiv = document.getElementById('weights');
const inputs = {};
weightInputs.forEach(w => {
  const label = document.createElement('label');
  label.className = 'flex items-center gap-2';
  label.innerHTML = `<span class="w-32">${w.label}</span><input type="number" class="text-black w-20 p-1 rounded" id="w-${w.key}" value="${w.default}" />`;
  weightsDiv.appendChild(label);
  inputs[w.key] = document.getElementById(`w-${w.key}`);
});

let players = [];

async function loadPlayers() {
  const res = await fetch('./data/players.json');
  players = await res.json();
  computeAndRender();
}

function getWeights() {
  const w = {};
  for (const key in inputs) w[key] = parseFloat(inputs[key].value) || 0;
  return w;
}

function computeAndRender() {
  const w = getWeights();
  players.forEach(p => {
    p.fppg =
      p.pts * w.pts +
      p.tpm * w.tpm +
      p.fga * w.fga +
      p.fgm * w.fgm +
      p.fta * w.fta +
      p.ftm * w.ftm +
      p.reb * w.reb +
      p.ast * w.ast +
      p.stl * w.stl +
      p.blk * w.blk +
      p.to * w.to;
  });
  const replacement = Math.min(...players.map(p => p.fppg));
  const totalPar = players.reduce((sum, p) => sum + (p.fppg - replacement), 0);
  players.forEach(p => {
    p.value = totalPar ? ((p.fppg - replacement) / totalPar) * 2000 : 0;
  });
  renderTable();
}

function renderTable() {
  const body = document.getElementById('players-body');
  body.innerHTML = '';
  players
    .slice()
    .sort((a, b) => b.fppg - a.fppg)
    .forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td class="text-right">${p.fppg.toFixed(1)}</td><td class="text-right">$${p.value.toFixed(0)}</td>`;
      body.appendChild(tr);
    });
}

document.getElementById('apply').addEventListener('click', computeAndRender);
loadPlayers();
