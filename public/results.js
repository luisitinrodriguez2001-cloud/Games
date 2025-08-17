export function createResultsModal() {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden';

  const box = document.createElement('div');
  box.className = 'bg-gray-800 text-gray-100 p-4 rounded flex flex-col items-center gap-2 max-w-xs w-full';
  overlay.appendChild(box);

  const messageEl = document.createElement('div');
  messageEl.className = 'text-lg font-semibold text-center';
  box.appendChild(messageEl);

  const trophyEl = document.createElement('div');
  const guessesEl = document.createElement('div');
  const streakEl = document.createElement('div');
  box.append(trophyEl, guessesEl, streakEl);

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.textContent = 'Share';
  shareBtn.className = 'px-4 py-2 rounded bg-green-500 text-gray-900 font-semibold';
  box.appendChild(shareBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.className = 'px-4 py-2 rounded bg-gray-700 text-gray-100';
  box.appendChild(closeBtn);

  document.body.appendChild(overlay);

  let shareText = '';

  shareBtn.addEventListener('click', async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      const old = shareBtn.textContent;
      shareBtn.textContent = 'Copied!';
      setTimeout(() => { shareBtn.textContent = old; }, 1000);
    } catch (e) {
      // ignore
    }
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  function show({win, target, trophies, guessesUsed, streak, share}) {
    messageEl.textContent = win ? 'You win!' : `You lose! ${target ? 'Word was ' + target.toUpperCase() : ''}`;
    trophyEl.textContent = `🏆 ${trophies}`;
    guessesEl.textContent = `Guesses: ${guessesUsed}`;
    streakEl.textContent = `Streak: ${streak}`;
    const verb = win ? 'guessed' : 'tried';
    const targetText = target ? ` ${target.toUpperCase()}` : '';
    const link = `${location.origin}${location.pathname}`;
    shareText = `Sandwichle++ — I ${verb}${targetText} in ${guessesUsed} guesses.\n${share}\n\nPlay: ${link}`;
    overlay.classList.remove('hidden');
  }

  return { show };
}
