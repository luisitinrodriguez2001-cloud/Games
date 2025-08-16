let words = [];
let currentList = [];
let secret = '';
let startWord = '';
let endWord = '';
let startIdx = 0;
let endIdx = 0;
let guesses = 0;
let resultsBoxes = [];

const GUESS_LIMIT = 10;

async function loadWords() {
  const res = await fetch('common_words.txt');
  const text = await res.text();
  words = text.split(/\s+/).filter(Boolean);
  startGame();
}

function startGame() {
  const len = parseInt(document.getElementById('wordLength').value, 10);
  currentList = words.filter(w => w.length === len).sort();
  if (currentList.length === 0) {
    document.getElementById('message').textContent = 'No words of that length.';
    return;
  }
  secret = currentList[Math.floor(Math.random() * currentList.length)];
  startIdx = 0;
  endIdx = currentList.length - 1;
  startWord = currentList[startIdx];
  endWord = currentList[endIdx];
  guesses = 0;
  resultsBoxes = [];
  updateBoundaries();
  document.getElementById('message').textContent = '';
  document.getElementById('history').innerHTML = '';
  updateCounter();
  document.getElementById('submitGuess').disabled = false;
  document.getElementById('guess').disabled = false;
  const input = document.getElementById('guess');
  input.value = '';
  input.maxLength = len;
  input.focus();
}

function submitGuess() {
  const input = document.getElementById('guess');
  let guess = input.value.trim().toLowerCase();
  const len = parseInt(document.getElementById('wordLength').value, 10);
  if (guess.length !== len) {
    document.getElementById('message').textContent = `Enter a ${len}-letter word.`;
    return;
  }
  if (!currentList.includes(guess)) {
    document.getElementById('message').textContent = 'Word not in list.';
    return;
  }
  const guessIdx = currentList.indexOf(guess);
  guesses++;
  let box = '';
  if (guess === secret) {
    box = '🟩';
    addHistory(guess, '=');
    resultsBoxes.push(box);
    document.getElementById('message').textContent = `You got it in ${guesses} guesses!`;
    updateCounter();
    endGame(true);
    return;
  }
  if (guessIdx <= startIdx || guessIdx >= endIdx) {
    document.getElementById('message').textContent = 'Guess out of range.';
    addHistory(guess, '!');
    box = '🟥';
  } else if (guess < secret) {
    startWord = guess;
    startIdx = guessIdx;
    document.getElementById('message').textContent = 'The word is after your guess.';
    addHistory(guess, '↑');
    box = '🟨';
  } else {
    endWord = guess;
    endIdx = guessIdx;
    document.getElementById('message').textContent = 'The word is before your guess.';
    addHistory(guess, '↓');
    box = '🟨';
  }
  resultsBoxes.push(box);
  updateBoundaries();
  updateCounter();
  if (guesses >= GUESS_LIMIT) {
    document.getElementById('message').textContent = `Out of guesses! The word was ${secret}.`;
    endGame(false);
  }
  input.value = '';
  input.focus();
}

function updateBoundaries() {
  document.getElementById('startWord').textContent = `${startIdx + 1}. ${startWord}`;
  document.getElementById('endWord').textContent = `${endIdx + 1}. ${endWord}`;
}

function updateCounter() {
  document.getElementById('guessCounter').textContent = `${guesses}/${GUESS_LIMIT}`;
}

function endGame(won) {
  document.getElementById('submitGuess').disabled = true;
  document.getElementById('guess').disabled = true;
  const score = won ? guesses : 'X';
  const share = `Betweenle Plus ${score}/${GUESS_LIMIT}\n${resultsBoxes.join('')}\n\nPlay at ${location.href}`;
  try {
    navigator.clipboard.writeText(share);
  } catch {}
  const res = document.getElementById('result');
  res.innerHTML = `<pre>${share}</pre><a href="${location.href}">${location.href}</a>`;
}

function addHistory(guess, indicator) {
  const li = document.createElement('li');
  const idx = currentList.indexOf(guess) + 1;
  li.textContent = `${idx}. ${guess} ${indicator}`;
  document.getElementById('history').appendChild(li);
}

document.getElementById('submitGuess').addEventListener('click', submitGuess);
document.getElementById('guess').addEventListener('keyup', (e) => {
  if (e.key === 'Enter') submitGuess();
});
document.getElementById('wordLength').addEventListener('change', startGame);
document.getElementById('darkMode').addEventListener('change', (e) => {
  document.body.classList.toggle('dark', e.target.checked);
});

loadWords();
