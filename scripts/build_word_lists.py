import json
import os
import re
from pathlib import Path

import requests
from wordfreq import zipf_frequency

DATA_DIR = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'words'
DATA_DIR.mkdir(parents=True, exist_ok=True)

MANIFEST = {}
GENERAL_WORDS = []


def pad_words(words, count=100):
    words = [w.strip().lower() for w in words if w]
    words = [re.sub(r"[^a-z' -]", '', w) for w in words]
    words = [w for w in words if w]
    uniq = []
    existing = set()
    for w in words:
        if w not in existing:
            uniq.append(w)
            existing.add(w)
    for w in GENERAL_WORDS:
        if len(uniq) >= count:
            break
        norm = re.sub(r"[^a-z' -]", '', w.strip().lower())
        if norm and norm not in existing:
            uniq.append(norm)
            existing.add(norm)
    return uniq[:count]


def pad_countries(items, count=100):
    names = {item['name'] for item in items}
    for w in GENERAL_WORDS:
        if len(items) >= count:
            break
        if w not in names:
            items.append({'name': w, 'code': '', 'flag': ''})
    return items[:count]


def pad_pokemon(items, count=100):
    names = {item['name'] for item in items}
    dex = max([item['dex'] for item in items], default=0) + 1
    for w in GENERAL_WORDS:
        if len(items) >= count:
            break
        if w not in names:
            items.append({'dex': dex, 'name': w})
            dex += 1
    return items[:count]

# Utility functions

def write_list(slug, name, words):
    # Normalize, deduplicate, sort
    norm = [w.strip().lower() for w in words if w]
    norm = [re.sub(r"[^a-z' -]", '', w) for w in norm]
    norm = [w for w in norm if w]
    uniq = sorted(set(norm))
    path = DATA_DIR / f'{slug}.json'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(uniq, f, ensure_ascii=False, indent=2)
    MANIFEST[slug] = {"file": f"./{slug}.json", "name": name}


def write_objects(slug, name, objects):
    path = DATA_DIR / f'{slug}.json'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(objects, f, ensure_ascii=False, indent=2)
    MANIFEST[slug] = {"file": f"./{slug}.json", "name": name}


# --- General 5-letter words from english words list + frequency filter ---

def build_general_words():
    url = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt'
    txt = requests.get(url, timeout=30).text
    words = [w for w in txt.split() if len(w) == 5 and zipf_frequency(w, 'en') >= 3]
    global GENERAL_WORDS
    GENERAL_WORDS = words
    write_list('general', 'General 5-letter Words', words)


# --- Ice-cream flavors from Wikidata ---

def build_icecream():
    query = """
    SELECT ?itemLabel WHERE {
      ?item wdt:P31 wd:Q131935021.
      SERVICE wikibase:label { bd:serviceParam wikibase:language 'en'. }
    }
    """
    url = 'https://query.wikidata.org/sparql'
    res = requests.get(url, params={'query': query, 'format': 'json'}, timeout=60).json()
    words = [b['itemLabel']['value'] for b in res['results']['bindings']]
    words = [w for w in words if len(w) == 5 and zipf_frequency(w, 'en') >= 2.5]
    words = pad_words(words)
    write_list('icecream', 'Icecream Flavors', words)


# --- College majors / academic disciplines from Wikidata ---

def build_majors():
    query = """
    SELECT ?itemLabel WHERE {
      ?item wdt:P31 wd:Q11862829.
      SERVICE wikibase:label { bd:serviceParam wikibase:language 'en'. }
    }
    """
    url = 'https://query.wikidata.org/sparql'
    res = requests.get(url, params={'query': query, 'format': 'json'}, timeout=60).json()
    words = [b['itemLabel']['value'] for b in res['results']['bindings']]
    words = [w for w in words if len(w) == 5 and zipf_frequency(w, 'en') >= 2.5]
    words = pad_words(words)
    write_list('majors', 'College Majors', words)


# --- Animals from open dataset ---

def build_animals():
    url = 'https://raw.githubusercontent.com/dariusk/corpora/master/data/animals/common.json'
    data = requests.get(url, timeout=30).json()
    words = [w for w in data.get('animals', []) if len(w) == 5 and zipf_frequency(w, 'en') >= 2.5]
    words = pad_words(words)
    write_list('animals', 'Animals', words)


# --- Countries from REST Countries API ---

def build_countries():
    url = 'https://restcountries.com/v3.1/all?fields=name,cca2,flags'
    data = requests.get(url, timeout=60).json()
    items = []
    for c in data:
        name = c.get('name', {}).get('common')
        code = c.get('cca2')
        flag = c.get('flags', {}).get('png') or c.get('flag')
        if name and code and len(name) == 5:
            items.append({'name': name, 'code': code, 'flag': flag})
    items.sort(key=lambda x: x['name'].lower())
    items = pad_countries(items)
    write_objects('countries', 'Countries', items)


# --- Pokémon from PokéAPI ---

def build_pokemon():
    url = 'https://pokeapi.co/api/v2/pokemon?limit=100000'
    data = requests.get(url, timeout=60).json()
    items = []
    for p in data.get('results', []):
        name = p['name']
        # parse dex from URL .../pokemon/1/
        m = re.search(r"/pokemon/(\d+)/", p['url'])
        dex = int(m.group(1)) if m else None
        if dex is not None and len(name) == 5:
            items.append({'dex': dex, 'name': name})
    items.sort(key=lambda x: x['dex'])
    items = pad_pokemon(items)
    write_objects('pokemon', 'Pokémon', items)


def main():
    build_general_words()
    build_icecream()
    build_majors()
    build_animals()
    build_countries()
    build_pokemon()
    # Write manifest
    manifest_path = DATA_DIR / 'manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(MANIFEST, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
