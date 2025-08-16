# Betweenle++

A static, mobile-first reimagining of the Betweenle word guessing game with multiple modes (words, numbers, countries, dates, Pokémon).

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
- `docs/betweenlepp-spec.md` – design summary.

The app works offline and seeds the daily puzzle from the UTC date so everyone sees the same challenge.
