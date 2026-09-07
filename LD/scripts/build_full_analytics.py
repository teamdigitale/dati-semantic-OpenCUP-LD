#!/usr/bin/env python3
"""Build Analisi chart JSON from full raw sources (DuckDB CLI, no intersection filter).

Graph visualizations stay on the hub LD sample; this script refreshes
web/public/data/analytics/*.json from OpenCUP + ANAC + PA Digitale + IndicePA
and SCP esiti (aggiudicazioni), plus territorial / status aggregates.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "srcdata" / "rawdata"
DATA = ROOT / "srcdata" / "data"
OUT = ROOT / "web" / "public" / "data" / "analytics"
TTL_ALL = ROOT / "LD" / "ttl" / "all.ttl"

OPENCUP = RAW / "OpenCUP.parquet"
CUP_JSON = RAW / "cup_json.json"
PAD = RAW / "candidature_comuni_finanziate.json"
IPA = RAW / "enti_ipa.csv"
BANDI = RAW / "v_od_bandi.csv"
ESITI = RAW / "v_od_esiti.csv"

IPA_CSV_OPTS = (
    "header=true, delim=',', quote='\"', escape='\"', "
    "strict_mode=false, ignore_errors=true"
)


def require_duckdb() -> str:
    exe = shutil.which("duckdb")
    if not exe:
        sys.exit("duckdb CLI not found on PATH (required for full analytics)")
    return exe


def duck_json(exe: str, sql: str) -> list | dict | None:
    """Run DuckDB and parse JSON output (ARRAY true COPY or -json SELECT)."""
    with tempfile.TemporaryDirectory(prefix="opencup-analytics-") as tmp:
        out = Path(tmp) / "out.json"
        # Prefer COPY … ARRAY true for stable list-of-objects
        wrapped = f"COPY (\n{sql}\n) TO '{out.as_posix()}' (FORMAT JSON, ARRAY true);"
        proc = subprocess.run(
            [exe, "-c", wrapped],
            capture_output=True,
            text=True,
            cwd=str(ROOT),
        )
        if proc.returncode != 0:
            # Scalar / single-row queries: use -json
            proc2 = subprocess.run(
                [exe, "-json", "-c", sql],
                capture_output=True,
                text=True,
                cwd=str(ROOT),
            )
            if proc2.returncode != 0:
                sys.stderr.write(proc.stderr or proc2.stderr)
                raise RuntimeError(f"duckdb failed:\n{sql[:500]}")
            text = proc2.stdout.strip()
            if not text:
                return None
            return json.loads(text)
        return json.loads(out.read_text(encoding="utf-8"))


def duck_scalar(exe: str, sql: str):
    rows = duck_json(exe, sql)
    if isinstance(rows, list) and rows:
        row = rows[0]
        return next(iter(row.values()))
    if isinstance(rows, dict):
        return next(iter(rows.values()))
    return None


def write_chart(path: Path, title: str, labels: list[str], series_name: str, data: list[float | int]) -> None:
    path.write_text(
        json.dumps(
            {
                "title": title,
                "labels": labels,
                "series": [{"name": series_name, "data": data}],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def write_json(path: Path, obj: object) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def chart_from_rows(
    rows: list[dict],
    label_key: str,
    value_key: str,
    title: str,
    series_name: str,
    out: Path,
    label_max: int | None = None,
) -> None:
    labels: list[str] = []
    data: list[float | int] = []
    for r in rows or []:
        lab = str(r.get(label_key) or "")
        if label_max is not None and len(lab) > label_max:
            lab = lab[:label_max]
        labels.append(lab)
        val = r.get(value_key)
        data.append(float(val) if isinstance(val, float) else int(val or 0))
    write_chart(out, title, labels, series_name, data)


def hub_counts() -> dict:
    """Optional hub (intersection) counts from filtered JSON + TTL size."""
    hub: dict = {}
    hub_path = DATA / "cupcig_candidature_comuni_finanziate.json"
    if hub_path.exists():
        pairs = json.loads(hub_path.read_text(encoding="utf-8"))["cupcig"]
        hub["hub_cups"] = len({r["CUP"] for r in pairs})
        hub["hub_cigs"] = len({r["CIG"] for r in pairs})
        hub["hub_pairs"] = len(pairs)
    oc = DATA / "opencup_candidature_comuni_finanziate.json"
    if oc.exists():
        hub["hub_opencup_cups"] = len(
            {r["CUP"] for r in json.loads(oc.read_text(encoding="utf-8"))["opencup"]}
        )
    cand = DATA / "candidature_comuni_finanziate.json"
    if cand.exists():
        rows = json.loads(cand.read_text(encoding="utf-8"))["candidature"]
        hub["hub_padigitale_rows"] = len(rows)
        hub["hub_padigitale_cups"] = len({r["codice_cup"] for r in rows})
    ipa = DATA / "candidature_enti_ipa.json"
    if ipa.exists():
        hub["hub_enti_ipa"] = len(json.loads(ipa.read_text(encoding="utf-8"))["enti"])
    if TTL_ALL.exists():
        # Approximate triple count without loading RDF: count non-empty non-prefix lines
        n = 0
        with TTL_ALL.open(encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith("@") or s.startswith("#"):
                    continue
                n += 1
        hub["hub_ttl_lines"] = n
    return hub


def main() -> None:
    for required in (OPENCUP, CUP_JSON, PAD, IPA):
        if not required.exists():
            sys.exit(f"Missing raw file: {required}")

    exe = require_duckdb()
    OUT.mkdir(parents=True, exist_ok=True)
    oc = OPENCUP.as_posix()
    cj = CUP_JSON.as_posix()
    pad = PAD.as_posix()
    ipa = IPA.as_posix()

    print("Analytics: cost by funder (OpenCUP full)…", flush=True)
    funder = duck_json(
        exe,
        f"""
        SELECT SOGGETTO_TITOLARE AS label,
               SUM(TRY_CAST(REPLACE(CAST(FINANZIAMENTO_PROGETTO AS VARCHAR), ',', '.') AS DOUBLE)) AS total
        FROM read_parquet('{oc}')
        WHERE SOGGETTO_TITOLARE IS NOT NULL AND CAST(SOGGETTO_TITOLARE AS VARCHAR) <> ''
        GROUP BY 1
        ORDER BY total DESC NULLS LAST
        LIMIT 15
        """,
    )
    chart_from_rows(
        funder if isinstance(funder, list) else [],
        "label",
        "total",
        "OpenCUP nazionale — costo per ente titolare (top 15)",
        "Euro",
        OUT / "cost_by_funder.json",
        label_max=50,
    )

    print("Analytics: cups by settore / categoria (OpenCUP full)…", flush=True)
    settore = duck_json(
        exe,
        f"""
        SELECT SETTORE_INTERVENTO AS label, COUNT(DISTINCT CUP) AS n
        FROM read_parquet('{oc}')
        WHERE SETTORE_INTERVENTO IS NOT NULL
          AND CAST(SETTORE_INTERVENTO AS VARCHAR) NOT IN ('', 'DATO NON PRESENTE', 'SETTORE_INTERVENTO')
        GROUP BY 1
        ORDER BY n DESC
        LIMIT 12
        """,
    )
    chart_from_rows(
        settore if isinstance(settore, list) else [],
        "label",
        "n",
        "OpenCUP nazionale — CUP per settore di intervento (top 12)",
        "Progetti",
        OUT / "cups_by_settore.json",
        label_max=40,
    )

    categoria = duck_json(
        exe,
        f"""
        SELECT CATEGORIA_INTERVENTO AS label, COUNT(DISTINCT CUP) AS n
        FROM read_parquet('{oc}')
        WHERE CATEGORIA_INTERVENTO IS NOT NULL
          AND CAST(CATEGORIA_INTERVENTO AS VARCHAR) NOT IN ('', 'DATO NON PRESENTE', 'CATEGORIA_INTERVENTO')
        GROUP BY 1
        ORDER BY n DESC
        LIMIT 12
        """,
    )
    chart_from_rows(
        categoria if isinstance(categoria, list) else [],
        "label",
        "n",
        "OpenCUP nazionale — CUP per categoria di intervento (top 12)",
        "Progetti",
        OUT / "cups_by_categoria.json",
        label_max=40,
    )

    print("Analytics: cost by call (PA Digitale full)…", flush=True)
    by_call = duck_json(
        exe,
        f"""
        SELECT avviso AS label, SUM(importo_finanziamento) AS total
        FROM read_json_auto('{pad}', maximum_object_size=200000000)
        WHERE avviso IS NOT NULL AND avviso <> ''
        GROUP BY 1
        ORDER BY total DESC NULLS LAST
        LIMIT 12
        """,
    )
    chart_from_rows(
        by_call if isinstance(by_call, list) else [],
        "label",
        "total",
        "PA Digitale completa — costo per avviso (top 12)",
        "Euro",
        OUT / "cost_by_call.json",
        label_max=50,
    )

    print("Analytics: CUP↔CIG distribution (ANAC full)…", flush=True)
    dist = duck_json(
        exe,
        f"""
        WITH per_cup AS (
          SELECT CUP, COUNT(*) AS nLots
          FROM read_json_auto('{cj}', maximum_object_size=500000000)
          WHERE CUP IS NOT NULL AND CUP <> ''
            AND UPPER(TRIM(CAST(CUP AS VARCHAR))) NOT IN (
              'ND', 'N.D.', 'N/D', 'NULL', 'NONE'
            )
            AND TRIM(CAST(CUP AS VARCHAR)) NOT IN ('0', '00')
            AND TRIM(CAST(CUP AS VARCHAR)) NOT LIKE '00000000000000%'
          GROUP BY 1
        ),
        bucketed AS (
          SELECT CASE
            WHEN nLots = 1 THEN '1'
            WHEN nLots = 2 THEN '2'
            WHEN nLots = 3 THEN '3'
            WHEN nLots = 4 THEN '4'
            WHEN nLots = 5 THEN '5'
            WHEN nLots BETWEEN 6 AND 10 THEN '6–10'
            WHEN nLots BETWEEN 11 AND 20 THEN '11–20'
            WHEN nLots BETWEEN 21 AND 50 THEN '21–50'
            WHEN nLots BETWEEN 51 AND 100 THEN '51–100'
            ELSE '101+'
          END AS bucket,
          CASE
            WHEN nLots = 1 THEN 1
            WHEN nLots = 2 THEN 2
            WHEN nLots = 3 THEN 3
            WHEN nLots = 4 THEN 4
            WHEN nLots = 5 THEN 5
            WHEN nLots BETWEEN 6 AND 10 THEN 6
            WHEN nLots BETWEEN 11 AND 20 THEN 7
            WHEN nLots BETWEEN 21 AND 50 THEN 8
            WHEN nLots BETWEEN 51 AND 100 THEN 9
            ELSE 10
          END AS ord
          FROM per_cup
        )
        SELECT bucket AS label, COUNT(*) AS nCups, MIN(ord) AS ord
        FROM bucketed
        GROUP BY 1
        ORDER BY ord
        """,
    )
    dist_rows = dist if isinstance(dist, list) else []
    write_chart(
        OUT / "cup_cig_distribution.json",
        "ANAC nazionale — distribuzione CUP per numero di CIG",
        [f"{r['label']} CIG" for r in dist_rows],
        "Progetti CUP",
        [int(r["nCups"]) for r in dist_rows],
    )

    top = duck_json(
        exe,
        f"""
        SELECT CUP AS label, COUNT(*) AS nLots
        FROM read_json_auto('{cj}', maximum_object_size=500000000)
        WHERE CUP IS NOT NULL AND CUP <> ''
          AND UPPER(TRIM(CAST(CUP AS VARCHAR))) NOT IN (
            'ND', 'N.D.', 'N/D', 'NULL', 'NONE'
          )
          AND TRIM(CAST(CUP AS VARCHAR)) NOT IN ('0', '00')
          AND TRIM(CAST(CUP AS VARCHAR)) NOT LIKE '00000000000000%'
        GROUP BY 1
        ORDER BY nLots DESC
        LIMIT 15
        """,
    )
    chart_from_rows(
        top if isinstance(top, list) else [],
        "label",
        "nLots",
        "ANAC nazionale — CUP con più CIG collegati (top 15)",
        "Lotti CIG",
        OUT / "top_cup_cig.json",
    )

    print("Analytics: OpenCUP by regione / stato…", flush=True)
    by_regione = duck_json(
        exe,
        f"""
        SELECT REGIONE AS label, COUNT(DISTINCT CUP) AS n
        FROM read_parquet('{oc}')
        WHERE REGIONE IS NOT NULL
          AND CAST(REGIONE AS VARCHAR) NOT IN ('', 'DATO NON PRESENTE', 'TUTTE')
        GROUP BY 1
        ORDER BY n DESC
        LIMIT 20
        """,
    )
    chart_from_rows(
        by_regione if isinstance(by_regione, list) else [],
        "label",
        "n",
        "OpenCUP nazionale — CUP per regione (top 20)",
        "Progetti",
        OUT / "cups_by_regione.json",
        label_max=40,
    )

    by_stato = duck_json(
        exe,
        f"""
        SELECT UPPER(TRIM(CAST(STATO_PROGETTO AS VARCHAR))) AS label,
               COUNT(DISTINCT CUP) AS n
        FROM read_parquet('{oc}')
        WHERE STATO_PROGETTO IS NOT NULL
          AND UPPER(TRIM(CAST(STATO_PROGETTO AS VARCHAR))) NOT IN (
            '', 'DATO NON PRESENTE', 'STATO_PROGETTO'
          )
        GROUP BY 1
        ORDER BY n DESC
        """,
    )
    chart_from_rows(
        by_stato if isinstance(by_stato, list) else [],
        "label",
        "n",
        "OpenCUP nazionale — CUP per stato del progetto",
        "Progetti",
        OUT / "opencup_by_stato.json",
        label_max=40,
    )

    print("Analytics: PA Digitale per regione / comuni…", flush=True)
    pad_regione = duck_json(
        exe,
        f"""
        SELECT regione AS label, SUM(importo_finanziamento) AS total
        FROM read_json_auto('{pad}', maximum_object_size=200000000)
        WHERE regione IS NOT NULL AND regione <> ''
        GROUP BY 1
        ORDER BY total DESC NULLS LAST
        LIMIT 20
        """,
    )
    chart_from_rows(
        pad_regione if isinstance(pad_regione, list) else [],
        "label",
        "total",
        "PA Digitale — finanziamento per regione",
        "Euro",
        OUT / "pad_cost_by_regione.json",
        label_max=40,
    )

    pad_comuni = duck_json(
        exe,
        f"""
        SELECT comune AS label, SUM(importo_finanziamento) AS total
        FROM read_json_auto('{pad}', maximum_object_size=200000000)
        WHERE comune IS NOT NULL AND comune <> ''
        GROUP BY 1
        ORDER BY total DESC NULLS LAST
        LIMIT 15
        """,
    )
    chart_from_rows(
        pad_comuni if isinstance(pad_comuni, list) else [],
        "label",
        "total",
        "PA Digitale — comuni con più finanziamento (top 15)",
        "Euro",
        OUT / "pad_top_comuni.json",
        label_max=40,
    )

    if ESITI.exists():
        print("Analytics: SCP top aggiudicatari…", flush=True)
        esiti = ESITI.as_posix()
        awards_lots = duck_json(
            exe,
            f"""
            WITH cleaned AS (
              SELECT
                COALESCE(
                  NULLIF(TRIM(CAST(cf_aggiudicatario AS VARCHAR)), ''),
                  NULLIF(TRIM(CAST(aggiudicatario AS VARCHAR)), '')
                ) AS key_id,
                COALESCE(
                  NULLIF(TRIM(CAST(aggiudicatario AS VARCHAR)), ''),
                  NULLIF(TRIM(CAST(cf_aggiudicatario AS VARCHAR)), '')
                ) AS display_name,
                UPPER(TRIM(CAST(cig AS VARCHAR))) AS cig
              FROM read_csv_auto('{esiti}', ignore_errors=true, strict_mode=false)
              WHERE (
                (cf_aggiudicatario IS NOT NULL AND TRIM(CAST(cf_aggiudicatario AS VARCHAR)) <> '')
                OR (aggiudicatario IS NOT NULL AND TRIM(CAST(aggiudicatario AS VARCHAR)) <> '')
              )
            ),
            per_lot AS (
              SELECT key_id, MAX(display_name) AS display_name, cig
              FROM cleaned
              WHERE key_id IS NOT NULL AND cig IS NOT NULL AND cig <> ''
              GROUP BY key_id, cig
            )
            SELECT MAX(display_name) AS label, COUNT(*) AS nLots
            FROM per_lot
            GROUP BY key_id
            ORDER BY nLots DESC
            LIMIT 15
            """,
        )
        chart_from_rows(
            awards_lots if isinstance(awards_lots, list) else [],
            "label",
            "nLots",
            "SCP MIT — soggetti con più lotti aggiudicati (top 15)",
            "Lotti CIG",
            OUT / "scp_top_aggiudicatari.json",
            label_max=50,
        )

        awards_euro = duck_json(
            exe,
            f"""
            WITH cleaned AS (
              SELECT
                COALESCE(
                  NULLIF(TRIM(CAST(cf_aggiudicatario AS VARCHAR)), ''),
                  NULLIF(TRIM(CAST(aggiudicatario AS VARCHAR)), '')
                ) AS key_id,
                COALESCE(
                  NULLIF(TRIM(CAST(aggiudicatario AS VARCHAR)), ''),
                  NULLIF(TRIM(CAST(cf_aggiudicatario AS VARCHAR)), '')
                ) AS display_name,
                UPPER(TRIM(CAST(cig AS VARCHAR))) AS cig,
                TRY_CAST(imp_di_aggiudicazione AS DOUBLE) AS importo
              FROM read_csv_auto('{esiti}', ignore_errors=true, strict_mode=false)
              WHERE (
                (cf_aggiudicatario IS NOT NULL AND TRIM(CAST(cf_aggiudicatario AS VARCHAR)) <> '')
                OR (aggiudicatario IS NOT NULL AND TRIM(CAST(aggiudicatario AS VARCHAR)) <> '')
              )
            ),
            per_lot AS (
              SELECT
                key_id,
                MAX(display_name) AS display_name,
                cig,
                MAX(importo) AS importo
              FROM cleaned
              WHERE key_id IS NOT NULL
                AND cig IS NOT NULL AND cig <> ''
                AND importo IS NOT NULL
                AND importo > 0
                AND importo <= 10000000
              GROUP BY key_id, cig
            )
            SELECT MAX(display_name) AS label, SUM(importo) AS total
            FROM per_lot
            GROUP BY key_id
            ORDER BY total DESC NULLS LAST
            LIMIT 15
            """,
        )
        chart_from_rows(
            awards_euro if isinstance(awards_euro, list) else [],
            "label",
            "total",
            "SCP MIT — top aggiudicatari per importo (lotti ≤ 10 M€, top 15)",
            "Euro",
            OUT / "scp_top_aggiudicatari_euro.json",
            label_max=50,
        )


    print("Analytics: counts + scope…", flush=True)
    opencup_cups = int(
        duck_scalar(exe, f"SELECT COUNT(DISTINCT CUP) AS n FROM read_parquet('{oc}')") or 0
    )
    opencup_rows = int(duck_scalar(exe, f"SELECT COUNT(*) AS n FROM read_parquet('{oc}')") or 0)
    anac_pairs = int(
        duck_scalar(
            exe,
            f"SELECT COUNT(*) AS n FROM read_json_auto('{cj}', maximum_object_size=500000000)",
        )
        or 0
    )
    anac_cups = int(
        duck_scalar(
            exe,
            f"SELECT COUNT(DISTINCT CUP) AS n FROM read_json_auto('{cj}', maximum_object_size=500000000)",
        )
        or 0
    )
    anac_cigs = int(
        duck_scalar(
            exe,
            f"SELECT COUNT(DISTINCT CIG) AS n FROM read_json_auto('{cj}', maximum_object_size=500000000)",
        )
        or 0
    )
    pad_rows = int(
        duck_scalar(
            exe,
            f"SELECT COUNT(*) AS n FROM read_json_auto('{pad}', maximum_object_size=200000000)",
        )
        or 0
    )
    pad_cups = int(
        duck_scalar(
            exe,
            f"SELECT COUNT(DISTINCT codice_cup) AS n FROM read_json_auto('{pad}', maximum_object_size=200000000)",
        )
        or 0
    )
    enti_ipa = int(
        duck_scalar(
            exe,
            f"SELECT COUNT(*) AS n FROM read_csv('{ipa}', {IPA_CSV_OPTS})",
        )
        or 0
    )

    scp_bandi_cigs = None
    scp_esiti_cigs = None
    if BANDI.exists():
        scp_bandi_cigs = int(
            duck_scalar(
                exe,
                f"""
                SELECT COUNT(DISTINCT UPPER(cig)) AS n
                FROM read_csv_auto('{BANDI.as_posix()}', ignore_errors=true, strict_mode=false)
                WHERE cig IS NOT NULL AND cig <> ''
                """,
            )
            or 0
        )
    if ESITI.exists():
        scp_esiti_cigs = int(
            duck_scalar(
                exe,
                f"""
                SELECT COUNT(DISTINCT UPPER(cig)) AS n
                FROM read_csv_auto('{ESITI.as_posix()}', ignore_errors=true, strict_mode=false)
                WHERE cig IS NOT NULL AND cig <> ''
                """,
            )
            or 0
        )

    hub = hub_counts()
    triples = hub.get("hub_ttl_lines", 0)

    counts = {
        "cups": opencup_cups,
        "lots": anac_cigs,
        "orgs": enti_ipa,
        "triples": triples,
        "opencup_cups": opencup_cups,
        "opencup_rows": opencup_rows,
        "anac_pairs": anac_pairs,
        "anac_cups": anac_cups,
        "anac_cigs": anac_cigs,
        "padigitale_rows": pad_rows,
        "padigitale_cups": pad_cups,
        "enti_ipa": enti_ipa,
        **{k: v for k, v in hub.items() if k.startswith("hub_")},
    }
    if scp_bandi_cigs is not None:
        counts["scp_bandi_cigs"] = scp_bandi_cigs
    if scp_esiti_cigs is not None:
        counts["scp_esiti_cigs"] = scp_esiti_cigs
    write_json(OUT / "counts.json", counts)

    scope = {
        "title": "Basi complete vs hub interop",
        "definition": (
            "Le statistiche Analisi sono calcolate sulle basi raw complete "
            "(OpenCUP, ANAC CUP↔CIG, PA Digitale, IndicePA, esiti SCP), senza filtro di intersezione. "
            "I grafi dell'unione semantica restano sul campione hub "
            "(PA Digitale ∩ ANAC ∩ esiti) e sui CUP più ricchi nell'unione."
        ),
        "mode": "full_raw",
        "filters": [
            {
                "step": "analytics-full",
                "rule": "Aggregati DuckDB su srcdata/rawdata/* (nessuna intersezione)",
                "role": "Chart Analisi + counts nazionali (quanto / chi / dove / stato)",
            },
            {
                "step": "01–05 filter + convertLD",
                "rule": "Hub PA Digitale ∩ ANAC cup_json ∩ v_od_esiti → JSON-LD/TTL",
                "role": "Grafo RDF e visualizzazioni unione (come sono collegati)",
            },
        ],
        "opencup_cups": opencup_cups,
        "opencup_rows": opencup_rows,
        "anac_pairs": anac_pairs,
        "anac_cups": anac_cups,
        "anac_cigs": anac_cigs,
        "padigitale_raw_cups": pad_cups,
        "padigitale_rows": pad_rows,
        "enti_ipa": enti_ipa,
        **hub,
        "gaps": [
            "Il RDF/JSON-LD resta sull'hub interop; le Analisi tabellari coprono le basi nazionali.",
            "SCP bandi/esiti: convertiti in RDF sull'hub (Lot + Award + Notice); analytics nazionali restano tabellari.",
            "Le mappe a grafo mostrano un campione di CUP, non milioni di nodi nazionali.",
            "Prossimi passi: ribassi/CPV più ricchi, stati candidatura PA Digitale, comuni via ISTAT/Wikidata.",
            "Nei ranking ANAC, CUP placeholder (ND, 000…) sono esclusi: non sono progetti validi.",
        ],
    }
    if scp_bandi_cigs is not None:
        scope["scp_bandi_cigs_full"] = scp_bandi_cigs
    if scp_esiti_cigs is not None:
        scope["scp_esiti_cigs_full"] = scp_esiti_cigs
    # Keep legacy keys used by Analisi UI where meaningful
    if "hub_cups" in hub:
        scope["hub_cups"] = hub["hub_cups"]
    if "hub_cigs" in hub:
        scope["hub_cigs"] = hub["hub_cigs"]

    write_json(OUT / "scope.json", scope)
    print(f"Web analytics (full sources) written to {OUT}", flush=True)


if __name__ == "__main__":
    main()
