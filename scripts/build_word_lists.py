import json
import re
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parent.parent / 'public' / 'data' / 'words'
MANIFEST = {}


def build_manifest():
    """Scan DATA_DIR for CSV files and build manifest.json."""
    pattern = re.compile(r'_5letters?$')
    for path in sorted(DATA_DIR.glob('*.csv')):
        slug_with_suffix = path.stem
        slug = pattern.sub('', slug_with_suffix)
        MANIFEST[slug] = {"file": f"./{path.name}", "name": slug}

    manifest_path = DATA_DIR / 'manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(MANIFEST, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    build_manifest()

