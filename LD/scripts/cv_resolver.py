"""Resolve OpenCUP classification codes to canonical PCM-DIPE SKOS URIs."""

from __future__ import annotations

import csv
import io
import sys
from pathlib import Path

PI_CV = "https://w3id.org/italia/PublicInvestment/controlled-vocabulary/"
CV_SCHEME = "classificazione_intervento"

CV_CSV = (
    Path(__file__).resolve().parents[1]
    / "controlled-vocabularies/classificazione-intervento/latest/classificazione_intervento.csv"
)

LEVEL_CLASS = {
    1: "Area_di_intervento",
    2: "Settore_di_intervento",
    3: "Sottosettore_di_intervento",
    4: "Categoria_di_intervento",
}

LEVEL_FIELDS = {
    1: "CODICE_AREA_INTERVENTO",
    2: "CODICE_SETTORE_INTERVENTO",
    3: "CODICE_SOTTOSETTORE_INTERVENTO",
    4: "CODICE_CATEGORIA_INTERVENTO",
}


def is_present(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() not in ("", "DATO NON PRESENTE")
    return True


def normalize_code(value) -> str | None:
    if not is_present(value):
        return None
    text = str(value).strip()
    if text.isdigit():
        return str(int(text))
    return text


def cv_uri(class_name: str, key: str) -> str:
    return f"{PI_CV}{CV_SCHEME}/{class_name}/{key}"


def parse_cv_row(line: str) -> list[str] | None:
    line = line.strip()
    if not line or "CODICE_ORIGINALE" in line:
        return None
    if line.startswith('"') and line.endswith('"'):
        line = line[1:-1]
    line = line.replace('""', '"')
    try:
        row = next(csv.reader(io.StringIO(line)))
    except (csv.Error, StopIteration):
        return None
    if len(row) < 5:
        return None
    return row


class CvResolver:
    def __init__(self, csv_path: Path | None = None):
        self.csv_path = csv_path or CV_CSV
        self.by_level_code_parent: dict[tuple[int, str, str], str] = {}
        self.keys: set[str] = set()
        self._load()

    def _load(self) -> None:
        if not self.csv_path.is_file():
            print(f"Warning: CV CSV not found at {self.csv_path}", file=sys.stderr)
            return
        with self.csv_path.open(encoding="utf-8", newline="") as handle:
            for raw_line in handle:
                row = parse_cv_row(raw_line)
                if not row:
                    continue
                try:
                    level = int(row[0])
                except ValueError:
                    continue
                code = normalize_code(row[2])
                key = row[3].strip()
                parent = row[5].strip() if len(row) > 5 else ""
                if not code or not key:
                    continue
                self.by_level_code_parent[(level, code, parent)] = key
                self.keys.add(key)

    def lookup(self, level: int, code, parent_key: str = "") -> str | None:
        norm = normalize_code(code)
        if not norm:
            return None
        parent = parent_key or ""
        key = self.by_level_code_parent.get((level, norm, parent))
        if key:
            return cv_uri(LEVEL_CLASS[level], key)
        return None

    def resolve_record(self, record: dict) -> dict[str, str | None]:
        """Resolve area → settore → sottosettore → categoria URIs for an OpenCUP record."""
        keys: dict[int, str | None] = {}
        uris: dict[str, str | None] = {
            "area": None,
            "settore": None,
            "sottosettore": None,
            "categoria": None,
        }

        area_code = normalize_code(record.get("CODICE_AREA_INTERVENTO"))
        if area_code:
            uri = self.lookup(1, area_code, "")
            if uri:
                keys[1] = area_code
                uris["area"] = uri
            else:
                print(
                    f"Warning: unresolved area code {area_code!r} (CUP {record.get('CUP')})",
                    file=sys.stderr,
                )

        settore_code = normalize_code(record.get("CODICE_SETTORE_INTERVENTO"))
        if settore_code and keys.get(1):
            parent = keys[1]
            uri = self.lookup(2, settore_code, parent)
            if uri:
                keys[2] = uri.rsplit("/", 1)[-1]
                uris["settore"] = uri
            else:
                print(
                    f"Warning: unresolved settore {settore_code!r} under area {parent!r} "
                    f"(CUP {record.get('CUP')})",
                    file=sys.stderr,
                )

        sottosettore_code = normalize_code(record.get("CODICE_SOTTOSETTORE_INTERVENTO"))
        if sottosettore_code and keys.get(2):
            parent = keys[2]
            uri = self.lookup(3, sottosettore_code, parent)
            if uri:
                keys[3] = uri.rsplit("/", 1)[-1]
                uris["sottosettore"] = uri
            else:
                print(
                    f"Warning: unresolved sottosettore {sottosettore_code!r} under {parent!r} "
                    f"(CUP {record.get('CUP')})",
                    file=sys.stderr,
                )

        categoria_code = normalize_code(record.get("CODICE_CATEGORIA_INTERVENTO"))
        if categoria_code and keys.get(3):
            parent = keys[3]
            uri = self.lookup(4, categoria_code, parent)
            if uri:
                uris["categoria"] = uri
            else:
                print(
                    f"Warning: unresolved categoria {categoria_code!r} under {parent!r} "
                    f"(CUP {record.get('CUP')})",
                    file=sys.stderr,
                )

        return uris


_default_resolver: CvResolver | None = None


def get_resolver() -> CvResolver:
    global _default_resolver
    if _default_resolver is None:
        _default_resolver = CvResolver()
    return _default_resolver
