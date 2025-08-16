let words = [];
let currentList = [];
let secret = '';
let startWord = '';
let endWord = '';
let guesses = 0;

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
  startWord = currentList[0];
  endWord = currentList[currentList.length - 1];
  guesses = 0;
  document.getElementById('startWord').textContent = startWord;
  document.getElementById('endWord').textContent = endWord;
  document.getElementById('message').textContent = '';
  document.getElementById('history').innerHTML = '';
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
  guesses++;
  if (guess === secret) {
    document.getElementById('message').textContent = `You got it in ${guesses} guesses!`;
    addHistory(guess, '=');
    return;
  }
  if (guess < secret) {
    startWord = guess;
    document.getElementById('message').textContent = 'The word is after your guess.';
    addHistory(guess, '↑');
  } else {
    endWord = guess;
    document.getElementById('message').textContent = 'The word is before your guess.';
    addHistory(guess, '↓');
  }
  document.getElementById('startWord').textContent = startWord;
  document.getElementById('endWord').textContent = endWord;
  input.value = '';
  input.focus();
}

function addHistory(guess, indicator) {
  const li = document.createElement('li');
  li.textContent = `${guess} ${indicator}`;
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
