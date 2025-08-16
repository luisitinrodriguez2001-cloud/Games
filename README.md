# Word Association — CodePen-ready game

This is a smooth, mobile-friendly word association game that uses **free public APIs** and a built-in list of common English words:

- **Datamuse** for association *clues* (the `rel_trg` “triggers” endpoint) and synonyms.
- **ConceptNet** for a semantic *closeness* score to drive the hot/cold meter.
- **Free Dictionary API** for definitions and part-of-speech.
- **Common word list** (top 1000 Google words) for selecting target words, with a Datamuse fallback.

No API keys are needed.

## How to use in CodePen

1. Open a new Pen.
2. Copy the contents of `index.html` into the **HTML** panel.
3. Copy `styles.css` into the **CSS** panel.
4. Copy `app.js` into the **JS** panel.
5. Save and run. (All calls are CORS-enabled and should work in the browser.)

## How it works

- **Round setup**: picks a **noun** from the common list; then fetches top noun associations via Datamuse (`rel_trg`), and the definition via Free Dictionary.
- **Guesses**: player entries must be nouns; each guess computes **relatedness** between the guess and the target using ConceptNet’s `/relatedness` endpoint. This drives a **temperature meter** and incremental scoring.
- **Hints**: revealing a hint uncovers one of the top Datamuse associations (costs points). Very cold guesses will auto-reveal an extra hint to keep the game flowing.
- **Modes**: Arcade (relaxed), Timed (90s timer), Daily (date-seeded hint order and streak tracking).
- **Persistence**: settings and stats saved to localStorage.
- **Exports**: Game events (start, guesses, finish) can be downloaded as a CSV.

## Files

- `index.html` — structure and footer links to source APIs.
- `styles.css` — modern gradient background, accessible palette, color-blind toggle.
- `app.js` — all logic, including API clients, hot/cold scoring, CSV export, daily streaks, and graceful fallbacks. Includes a common word list loader for simpler targets.

## Betweenle Plus

A lightweight, ad-free clone of the Betweenle word guessing game.
Options include selectable word length (4-6 letters) and a dark mode toggle.
Load `betweenle.html` in a browser to play.

## Notes

- ConceptNet relatedness values are typically ~0.05–0.40 for loosely related words; thresholds are tuned in code but easily adjustable.
- If the local list fails to load, a Datamuse pattern-based fallback is used to pick a fairly common word.
- Turn on **Strict validation** in Settings to require dictionary-confirmed words for guesses.

Enjoy!