"""Resolve OpenCUP classification codes to canonical PCM-DIPE SKOS URIs."""

from __future__ import annotations

import csv
import io
import sys
from pathlib import Path

PI_CV = "https://w3id.org/italia/PublicInvestment/controlled-vocabulary/"
CV_SCHEME = "classificazione_intervento"
NATURA_SCHEME = "natura_intervento"
TIPOLOGIA_SCHEME = "tipologia_intervento"

CV_DIR = Path(__file__).resolve().parents[1] / "controlled-vocabularies"
CV_CSV = CV_DIR / "classificazione-intervento/latest/classificazione_intervento.csv"
NATURA_CSV = CV_DIR / "natura-intervento/latest/natura_intervento.csv"
TIPOLOGIA_CSV = CV_DIR / "tipologia-intervento/latest/tipologia_intervento.csv"

LEVEL_CLASS = {
    1: "Area_di_intervento",
    2: "Settore_di_intervento",
    3: "Sottosettore_di_intervento",
    4: "Categoria_di_intervento",
}

# Codici OpenCUP pre-rinumerazione → codici ufficiali PCM-DIPE (natura_intervento).
LEGACY_NATURA_CODE = {
    "04": "06",
    "05": "07",
    "06": "08",
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


def format_cv_code(value) -> str | None:
    """Zero-pad numeric codes as in PCM-DIPE CV keys (01, 02, 19…)."""
    if not is_present(value):
        return None
    if isinstance(value, int):
        return str(value).zfill(2)
    text = str(value).strip()
    if text.isdigit():
        return text.zfill(2)
    return text


def cv_uri(class_name: str, key: str) -> str:
    return f"{PI_CV}{CV_SCHEME}/{class_name}/{key}"


def natura_uri(key: str) -> str:
    return f"{PI_CV}{NATURA_SCHEME}/{key}"


def tipologia_uri(key: str) -> str:
    return f"{PI_CV}{TIPOLOGIA_SCHEME}/{key}"


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
    def __init__(
        self,
        csv_path: Path | None = None,
        natura_csv: Path | None = None,
        tipologia_csv: Path | None = None,
    ):
        self.csv_path = csv_path or CV_CSV
        self.natura_csv = natura_csv or NATURA_CSV
        self.tipologia_csv = tipologia_csv or TIPOLOGIA_CSV
        self.by_level_code_parent: dict[tuple[int, str, str], str] = {}
        self.keys: set[str] = set()
        self.natura_codes: set[str] = set()
        self.tipologia_keys: set[str] = set()
        self._load()
        self._load_natura()
        self._load_tipologia()

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

    def _load_natura(self) -> None:
        if not self.natura_csv.is_file():
            print(f"Warning: natura CV CSV not found at {self.natura_csv}", file=sys.stderr)
            return
        with self.natura_csv.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                code = (row.get("CODICE_NATURA_INTERVENTO") or "").strip()
                if code:
                    self.natura_codes.add(code)

    def _load_tipologia(self) -> None:
        if not self.tipologia_csv.is_file():
            print(
                f"Warning: tipologia CV CSV not found at {self.tipologia_csv}",
                file=sys.stderr,
            )
            return
        with self.tipologia_csv.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                key = (row.get("CODICE_NATURA_E_TIPO") or "").strip()
                if key:
                    self.tipologia_keys.add(key)

    def lookup(self, level: int, code, parent_key: str = "") -> str | None:
        norm = normalize_code(code)
        if not norm:
            return None
        parent = parent_key or ""
        key = self.by_level_code_parent.get((level, norm, parent))
        if key:
            return cv_uri(LEVEL_CLASS[level], key)
        return None

    def resolve_natura(self, code, *, cup: str | None = None) -> str | None:
        """Resolve CODICE_NATURA_INTERVENTO to official natura_intervento/{code}."""
        key = format_cv_code(code)
        if not key:
            return None
        if key in self.natura_codes:
            return natura_uri(key)
        remapped = LEGACY_NATURA_CODE.get(key)
        if remapped and remapped in self.natura_codes:
            print(
                f"Warning: remapped legacy natura {key!r} → {remapped!r}"
                + (f" (CUP {cup})" if cup else ""),
                file=sys.stderr,
            )
            return natura_uri(remapped)
        print(
            f"Warning: unresolved natura code {key!r}"
            + (f" (CUP {cup})" if cup else ""),
            file=sys.stderr,
        )
        return None

    def resolve_tipologia(
        self, natura_code, tipo_code, *, cup: str | None = None
    ) -> str | None:
        """Resolve natura+tipo to tipologia_intervento/{natura}_{tipo}."""
        natura = format_cv_code(natura_code)
        tipo = format_cv_code(tipo_code)
        if not natura or not tipo:
            return None
        if natura not in self.natura_codes:
            natura = LEGACY_NATURA_CODE.get(natura, natura)
        key = f"{natura}_{tipo}"
        if key in self.tipologia_keys:
            return tipologia_uri(key)
        print(
            f"Warning: unresolved tipologia {key!r}"
            + (f" (CUP {cup})" if cup else ""),
            file=sys.stderr,
        )
        return None

    def resolve_record(self, record: dict) -> dict[str, str | None]:
        """Resolve area → settore → sottosettore → categoria + natura/tipologia URIs."""
        keys: dict[int, str | None] = {}
        cup = str(record.get("CUP") or "")
        uris: dict[str, str | None] = {
            "area": None,
            "settore": None,
            "sottosettore": None,
            "categoria": None,
            "natura": None,
            "tipologia": None,
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

        uris["natura"] = self.resolve_natura(
            record.get("CODICE_NATURA_INTERVENTO"), cup=cup
        )
        uris["tipologia"] = self.resolve_tipologia(
            record.get("CODICE_NATURA_INTERVENTO"),
            record.get("CODICE_TIPO_INTERVENTO"),
            cup=cup,
        )

        return uris


_default_resolver: CvResolver | None = None


def get_resolver() -> CvResolver:
    global _default_resolver
    if _default_resolver is None:
        _default_resolver = CvResolver()
    return _default_resolver
