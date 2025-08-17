import json
import re
from pathlib import Path

import requests
from wordfreq import zipf_frequency

DATA_DIR = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'words'
DATA_DIR.mkdir(parents=True, exist_ok=True)

MANIFEST = {}


def add_csv(slug, name):
    """Register an existing CSV list with the manifest."""
    path = DATA_DIR / f"{slug}.csv"
    with open(path, "r", encoding="utf-8") as f:
        words = [line.strip().lower() for line in f if line.strip()]
    for w in words:
        if not re.fullmatch(r"[a-z]{5}", w):
            raise ValueError(f"{slug} list contains invalid word: {w}")
    MANIFEST[slug] = {"file": f"./{slug}.csv", "name": name}


def write_csv(slug, name, words):
    """Normalize, dedupe, write out a CSV list and register it."""
    norm = [w.strip().lower() for w in words if w]
    norm = [re.sub(r"[^a-z' -]", '', w) for w in norm]
    norm = [w for w in norm if w]
    uniq = []
    existing = set()
    for w in norm:
        if w not in existing:
            uniq.append(w)
            existing.add(w)
    path = DATA_DIR / f"{slug}.csv"
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(uniq))
    MANIFEST[slug] = {"file": f"./{slug}.csv", "name": name}


# --- General 5-letter words from english words list + frequency filter ---

def build_general_words():
    url = "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt"
    txt = requests.get(url, timeout=30).text
    words = [w for w in txt.split() if len(w) == 5 and zipf_frequency(w, "en") >= 3]
    write_csv("general", "General 5-letter Words", words)


# --- Countries from REST Countries API ---

def build_countries():
    url = 'https://restcountries.com/v3.1/all?fields=name'
    data = requests.get(url, timeout=60).json()
    names = []
    for c in data:
        name = c.get('name', {}).get('common')
        if name and len(name) == 5:
            names.append(name)
    names.sort(key=lambda x: x.lower())
    write_csv("countries", "Countries", names)


# --- Pokémon from PokéAPI ---

def build_pokemon():
    url = 'https://pokeapi.co/api/v2/pokemon?limit=100000'
    data = requests.get(url, timeout=60).json()
    items = []
    for p in data.get('results', []):
        name = p['name']
        m = re.search(r"/pokemon/(\d+)/", p['url'])
        dex = int(m.group(1)) if m else None
        if dex is not None and len(name) == 5:
            items.append((dex, name))
    items.sort(key=lambda x: x[0])
    names = [name for _, name in items]
    write_csv("pokemon", "Pokémon", names)


def main():
    build_general_words()
    add_csv("icecream", "Icecream Flavors")
    add_csv("majors", "College Majors")
    add_csv("animals", "Animals")
    build_countries()
    build_pokemon()
    # Write manifest
    manifest_path = DATA_DIR / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(MANIFEST, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
