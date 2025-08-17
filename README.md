# Sandwichle++

A static, mobile-first guessing game where you find the secret entry sandwiched alphabetically between two others, with multiple modes (words, numbers, countries, dates, Pokémon).

In word mode, a new **Hint** button fetches the target word's definition from an online dictionary API to help you guess.

## Development

```
npm install
npm run dev
```

`npm run build` creates a production bundle and `npm run serve` previews it.

## Structure

- `public/` – standalone app pages and assets.
- `public/engine/` – reusable game engine modules.
- `public/data/` – word lists and other domain data.
- `docs/sandwichlepp-spec.md` – design summary.

The app works offline and seeds the daily puzzle from the UTC date so everyone sees the same challenge.
