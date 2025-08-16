# Betweenle++ Design Notes

Betweenle++ extends the classic alphabetical guessing game with an engine that supports multiple domains and deterministic daily seeds. Each mode provides a sorted list and comparator to the core engine, which maintains bounds, inserts guesses in order, tracks the closest attempt with an orange marker, and reports win or loss after a fixed number of guesses (14 by default).

Pages: `betweenle.html`, `numbers.html`, `countries.html`, `dates.html`, and `pokemon.html` load the shared shell in `app.js`. The shell mounts a header with a countdown to the next UTC midnight, a scrollable log of guesses, and a bottom composer. Modes are selected via separate pages and can run in daily or practice mode.

Daily puzzles derive their secret via a hash of `YYYYMMDD:MODE:CATEGORY:SALT` so the same challenge appears offline for all players. Practice mode uses a random seed.
