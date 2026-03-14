#!/usr/bin/env python3
"""
Download CC-licensed Islamic architecture models from Sketchfab.

Usage:
  1. Create a free Sketchfab account at https://sketchfab.com/signup
  2. Go to https://sketchfab.com/settings/password → API Token
  3. Run: python scripts/download_sketchfab.py YOUR_API_TOKEN

  Or set the env var:
     export SKETCHFAB_TOKEN=YOUR_API_TOKEN
     python scripts/download_sketchfab.py
"""

import os
import sys
import json
import time
import zipfile
import urllib.request
import urllib.error
from pathlib import Path

MODELS_DIR = Path(__file__).parent.parent / "assets" / "models" / "sketchfab"

# Curated CC-licensed Islamic architecture models found via Sketchfab API
MODELS = [
    {
        "uid": "cefd48a8a50b4fc39cbe69f3f63e5a37",
        "name": "door_panel_14c_egyptian",
        "description": "Door Panel, 14th century Egyptian",
        "license": "CC0",
        "category": "geometric_patterns",
    },
    {
        "uid": "0ade13f4a9724e67a68a5fd8935903eb",
        "name": "muqarnas_wall",
        "description": "Muqarnas Wall",
        "license": "CC-BY",
        "category": "muqarnas",
    },
    {
        "uid": "21b2aa7053b14730b51d9a4956b3b007",
        "name": "muqarnas_archway",
        "description": "Muqarnas Archway",
        "license": "CC-BY",
        "category": "muqarnas",
    },
    {
        "uid": "542ce00ef4a74305b94ea9cd95e6f10a",
        "name": "muqarnas_small_dome",
        "description": "Muqarnas Small Dome",
        "license": "CC-BY",
        "category": "muqarnas",
    },
    {
        "uid": "a60e4d5f34aa4a6280343a8f15bb1c13",
        "name": "mashrabiya",
        "description": "Mashrabiya lattice screen",
        "license": "CC-BY",
        "category": "mashrabiya",
    },
    {
        "uid": "bd1ad1598f0b440ebf1bea0c55346cac",
        "name": "islamic_dome_yazd",
        "description": "Islamic Dome Yazd",
        "license": "CC-BY",
        "category": "domes",
    },
    {
        "uid": "2ba2841ece1e46e5b877858c7e17c8dd",
        "name": "islamic_patterns",
        "description": "Islamic Patterns tile",
        "license": "CC-BY",
        "category": "geometric_patterns",
    },
    {
        "uid": "cb7f34f0bad74d499ce85aae221adfe1",
        "name": "mosque_tree_buqayawiyya",
        "description": "Mosque of Tree of Al Buqayawiyya",
        "license": "CC-BY",
        "category": "other",
    },
]


def get_download_url(uid: str, token: str) -> str | None:
    """Get the glTF download URL for a model."""
    url = f"https://api.sketchfab.com/v3/models/{uid}/download"
    req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            # Prefer glTF, fall back to others
            for fmt in ["gltf", "source", "usdz"]:
                if fmt in data:
                    return data[fmt]["url"]
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(f"  ERROR: Invalid API token")
        elif e.code == 403:
            print(f"  ERROR: Model {uid} not downloadable (may need purchase)")
        elif e.code == 429:
            print(f"  Rate limited - waiting 60s...")
            time.sleep(60)
            return get_download_url(uid, token)
        else:
            print(f"  ERROR: HTTP {e.code} for {uid}")
    return None


def download_and_extract(url: str, dest: Path, name: str) -> bool:
    """Download a zip and extract 3D model files."""
    zip_path = dest / f"{name}.zip"
    model_dir = dest / name

    print(f"  Downloading...")
    try:
        urllib.request.urlretrieve(url, zip_path)
    except Exception as e:
        print(f"  ERROR downloading: {e}")
        return False

    print(f"  Extracting...")
    model_dir.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(model_dir)
        zip_path.unlink()
        # List extracted files
        for f in sorted(model_dir.rglob("*")):
            if f.is_file():
                print(f"    -> {f.relative_to(dest)}")
        return True
    except zipfile.BadZipFile:
        # Might be a direct file, not a zip
        zip_path.rename(model_dir / f"{name}.glb")
        print(f"    -> {name}/{name}.glb")
        return True


def search_more_models(token: str, query: str = "islamic architecture", count: int = 20):
    """Search Sketchfab for additional downloadable CC-licensed models."""
    url = (
        f"https://api.sketchfab.com/v3/search?type=models"
        f"&q={query.replace(' ', '+')}"
        f"&downloadable=true&count={count}"
        f"&license=by&license=by-sa&license=by-nd&license=cc0"
    )
    req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            results = data.get("results", [])
            print(f"\nFound {len(results)} additional downloadable CC-licensed models:")
            for r in results:
                print(f"  - {r['name']} (uid: {r['uid']}, license: {r.get('license', {}).get('label', 'unknown')})")
            return results
    except Exception as e:
        print(f"Search error: {e}")
        return []


def main():
    token = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("SKETCHFAB_TOKEN")
    if not token:
        print(__doc__)
        print("ERROR: No API token provided.")
        print("\nSteps:")
        print("  1. Sign up free at https://sketchfab.com/signup")
        print("  2. Go to https://sketchfab.com/settings/password")
        print("  3. Copy your API Token")
        print(f"  4. Run: python {sys.argv[0]} YOUR_TOKEN")
        sys.exit(1)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Downloading {len(MODELS)} CC-licensed Islamic architecture models...\n")

    success = 0
    for model in MODELS:
        print(f"[{model['category']}] {model['description']} ({model['license']})")
        url = get_download_url(model["uid"], token)
        if url:
            dest = MODELS_DIR / model["category"]
            dest.mkdir(parents=True, exist_ok=True)
            if download_and_extract(url, dest, model["name"]):
                success += 1
        else:
            print(f"  Skipped (no download URL)")
        time.sleep(1)  # Be nice to the API

    print(f"\nDone! Downloaded {success}/{len(MODELS)} models to {MODELS_DIR}")

    # Optionally search for more
    if "--search" in sys.argv:
        for query in ["muqarnas", "islamic arch", "mashrabiya", "islamic dome", "arabesque"]:
            search_more_models(token, query)


if __name__ == "__main__":
    main()
