#!/usr/bin/env python3
"""Download ontology and controlled vocabulary assets from PCM-DIPE/public-investment."""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_BASE = (
    "https://raw.githubusercontent.com/PCM-DIPE/public-investment/main/assets"
)
COMMIT_API = (
    "https://api.github.com/repos/PCM-DIPE/public-investment/commits/main"
)

ASSETS = [
    (
        f"{RAW_BASE}/ontologies/public-investment/latest/public-investment.ttl",
        ROOT / "LD/ontologies/public-investment/latest/public-investment.ttl",
    ),
    (
        f"{RAW_BASE}/controlled-vocabularies/classificazione_intervento/latest/classificazione_intervento.ttl",
        ROOT
        / "LD/controlled-vocabularies/classificazione-intervento/latest/classificazione_intervento.ttl",
    ),
    (
        f"{RAW_BASE}/controlled-vocabularies/classificazione_intervento/latest/classificazione_intervento.csv",
        ROOT
        / "LD/controlled-vocabularies/classificazione-intervento/latest/classificazione_intervento.csv",
    ),
]


def fetch_url(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "dati-semantic-OpenCUP-LD"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def fetch_commit_sha() -> str | None:
    try:
        req = urllib.request.Request(COMMIT_API, headers={"User-Agent": "dati-semantic-OpenCUP-LD"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        return data.get("sha")
    except OSError as exc:
        print(f"Warning: could not fetch commit SHA ({exc})", file=sys.stderr)
        return None


def main() -> None:
    sha = fetch_commit_sha()
    fetched_at = datetime.now(timezone.utc).isoformat()

    for url, dest in ASSETS:
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"Fetching {url}")
        content = fetch_url(url)
        dest.write_bytes(content)
        print(f"  → {dest} ({len(content)} bytes)")

    manifest = {
        "source": "https://github.com/PCM-DIPE/public-investment/tree/main/assets",
        "commit": sha,
        "fetched_at": fetched_at,
        "files": [str(dest.relative_to(ROOT)) for _, dest in ASSETS],
    }
    manifest_path = ROOT / "LD/assets-manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
