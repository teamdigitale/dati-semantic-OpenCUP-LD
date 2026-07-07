import json
import re
import urllib.parse
from pybars import Compiler

PI_ONTO = "https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/"
PI_DATA = "https://w3id.org/italia/PublicInvestment/data/CUP/"
PI_CV = "https://w3id.org/italia/PublicInvestment/controlled-vocabulary/"
COV_DATA = "https://w3id.org/italia/data/PublicOrganization/"

NATURE_INDIVIDUAL = {
    "01": "acquisto_di_beni",
    "02": "acquisto_o_realizzazione_di_servizi",
    "03": "realizzazione_di_lavori_pubblici",
    "04": "concessione_di_contributi_ad_altri_soggetti",
    "05": "concessione_di_incentivi_ad_unità_produttive",
    "06": "sottoscrizione_iniziale_o_aumento_di_capitale",
}

NATURE_CLASS = {
    "01": "Acquisto_di_beni",
    "02": "Acquisto_o_realizzazione_di_servizi",
    "03": "Realizzazione_di_lavori_pubblici",
    "04": "Concessione_di_contributi_ad_altri_soggetti",
    "05": "Concessione_di_incentivi_ad_unità_produttive",
    "06": "Sottoscrizione_iniziale_o_aumento_di_capitale",
}

STATO_CLASS = {
    "ATTIVO": "Stato_attivo_di_cup",
    "CHIUSO": "Stato_chiuso_di_cup",
    "REVOCATO": "Stato_revocato_di_cup",
    "CANCELLATO": "Stato_cancellato_di_cup",
}

CV_TYPES = {
    "settore": ("settore-intervento", "Settore_di_intervento"),
    "tipologia": ("tipologia-intervento", "Tipologia_di_intervento"),
    "sottosettore": ("sottosettore-intervento", "Sottosettore_di_intervento"),
    "categoria": ("categoria-intervento", "Categoria_di_intervento"),
    "area": ("area-intervento", "Area_di_intervento"),
    "copertura": ("copertura-finanziaria", "Tipologia_copertura_finanziaria"),
    "strumento": ("strumento-programmazione", "Tipo_strumento_di_programmazione"),
}

MONTHS = {
    "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04",
    "MAY": "05", "JUN": "06", "JUL": "07", "AUG": "08",
    "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12",
}


def is_present(value):
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() not in ("", "DATO NON PRESENTE")
    return True


def encodeURIComponent(this, value):
    return urllib.parse.quote(str(value))


def normalize_cup(cup):
    return str(cup).strip().upper()


def cupUri(this, cup):
    return f"{PI_DATA}{normalize_cup(cup)}"


def cvUri(this, tipo, codice):
    slug, _ = CV_TYPES[tipo]
    code = str(codice).zfill(2) if tipo != "strumento" else str(codice).zfill(2)
    return f"{PI_CV}{slug}/{code}"


def format_code(value):
    if value is None:
        return None
    if isinstance(value, int):
        return str(value).zfill(2)
    text = str(value).strip()
    if text.isdigit():
        return text.zfill(2)
    return text


def date_to_iso(value):
    if not is_present(value):
        return None
    text = str(value).strip()
    match = re.match(r"^(\d{2})-([A-Z]{3})-(\d{4})$", text)
    if match:
        day, mon, year = match.groups()
        return f"{year}-{MONTHS[mon]}-{day}"
    return text


def if_present(this, value, options):
    if is_present(value):
        return options["fn"](this)
    if "inverse" in options:
        return options["inverse"](this)
    return ""


def skos_concept(cv_type, code, label):
    if not is_present(code):
        return None
    slug, pi_class = CV_TYPES[cv_type]
    code_str = format_code(code)
    node = {
        "@id": f"{PI_CV}{slug}/{code_str}",
        "@type": [f"pi:{pi_class}", "skos:Concept"],
        "skos:notation": code_str,
    }
    if is_present(label):
        node["skos:prefLabel"] = str(label).strip()
    return node


def build_opencup_nodes(record):
    cup = normalize_cup(record["CUP"])
    cup_uri = f"{PI_DATA}{cup}"
    nodes = []
    concepts = {}

    def remember_concept(cv_type, code, label):
        concept = skos_concept(cv_type, code, label)
        if concept:
            concepts[concept["@id"]] = concept
        return concept

    cup_types = ["pi:Progetto_di_investimento_pubblico", "pi:Codice_unico_di_progetto"]
    if record.get("TIPOLOGIA_CUP") == "CUMULATIVO":
        cup_types.append("pi:Cup_cumulativo")

    project = {
        "@id": cup_uri,
        "@type": cup_types,
        "pi:ha_cup": {"@id": cup_uri},
        "pi:ha_intervento_di_investimento_pubblico": {"@id": f"_:intervento-{cup}"},
        "pi:ha_soggetto_titolare": {
            "@id": f"{COV_DATA}{urllib.parse.quote(str(record['PIVA_CODFISCALE_SOG_TITOLARE']))}",
        },
    }

    if is_present(record.get("COSTO_PROGETTO")):
        project["pi:costo_del_progetto"] = record["COSTO_PROGETTO"]
    if is_present(record.get("FINANZIAMENTO_PROGETTO")):
        project["pi:importo_finanziamento_pubblico"] = record["FINANZIAMENTO_PROGETTO"]
    if is_present(record.get("ANNO_DECISIONE")):
        project["pi:anno_di_decisione"] = record["ANNO_DECISIONE"]
    if is_present(record.get("FLAG_LEGGE_OBIETTIVO")):
        project["pi:avviso_legge_obiettivo"] = record["FLAG_LEGGE_OBIETTIVO"]
    if is_present(record.get("CODICE_LOCALE_PROGETTO")):
        project["pi:codifica_locale_progetto"] = str(record["CODICE_LOCALE_PROGETTO"])

    gen_date = date_to_iso(record.get("DATA_GENERAZIONE_CUP"))
    if gen_date:
        project["pi:data_generazione_cup"] = {"@value": gen_date, "@type": "xsd:date"}

    cop = remember_concept("copertura", record.get("CODICE_COPERTURA_FINANZIARIA"), record.get("COPERTURA_FINANZIARIA"))
    if cop:
        project["pi:ha_tipologia_copertura_finanziaria"] = {"@id": cop["@id"]}

    strumento = remember_concept("strumento", record.get("CODICE_STRUMENTO_PROGRAM"), record.get("STRUMENTO_PROGRAMMAZIONE"))
    if strumento:
        project["pi:ha_strumento_di_programmazione"] = {"@id": strumento["@id"]}

    if is_present(record.get("INDIRIZZO_INTERVENTO")) or is_present(record.get("COMUNE")):
        addr = {"@id": f"_:address-{cup}", "@type": "CLV:Address"}
        if is_present(record.get("INDIRIZZO_INTERVENTO")):
            addr["CLV:fullAddress"] = record["INDIRIZZO_INTERVENTO"]
        if is_present(record.get("COMUNE")):
            addr["CLV:cityName"] = record["COMUNE"]
        if is_present(record.get("PROVINCIA")):
            addr["CLV:provinceName"] = record["PROVINCIA"]
        if is_present(record.get("REGIONE")):
            addr["CLV:regionName"] = record["REGIONE"]
        if is_present(record.get("CODICE_COMUNE")) and str(record.get("CODICE_COMUNE")) not in ("-1",):
            addr["CLV:cityCode"] = str(record["CODICE_COMUNE"]).zfill(6)
        project["pi:ha_localizzazione"] = {"@id": addr["@id"]}
        project["pi:ha_indirizzo_o_riferimento"] = {"@id": addr["@id"]}
        nodes.append(addr)

    stato = record.get("STATO_PROGETTO")
    if is_present(stato):
        storia_types = ["pi:Storia_di_cup"]
        stato_class = STATO_CLASS.get(str(stato).strip().upper())
        if stato_class:
            storia_types.append(f"pi:{stato_class}")
        storia = {"@id": f"_:storia-{cup}", "@type": storia_types}
        chiusura = date_to_iso(record.get("DATA_CHIUSURA_REVOCA"))
        if chiusura:
            storia["pi:data_chiusura_prevista"] = {"@value": chiusura, "@type": "xsd:date"}
        project["pi:ha_stato_di_cup"] = storia
        nodes.append(storia)

    if is_present(record.get("CUP_MASTER")):
        project["pi:ha_cup_master_collegato"] = {"@id": f"{PI_DATA}{record['CUP_MASTER']}"}
    if is_present(record.get("CUP_IN_RELAZIONE")):
        project["pi:ha_cup_collegato"] = {"@id": f"{PI_DATA}{record['CUP_IN_RELAZIONE']}"}

    nature_code = format_code(record.get("CODICE_NATURA_INTERVENTO"))
    intervention_types = ["pi:Intervento_di_investimento_pubblico"]
    if nature_code and nature_code in NATURE_CLASS:
        intervention_types.append(f"pi:{NATURE_CLASS[nature_code]}")

    intervention = {
        "@id": f"_:intervento-{cup}",
        "@type": intervention_types,
    }
    if is_present(record.get("DESCRIZIONE_SINTETICA_CUP")):
        intervention["pi:oggetto_progettuale"] = record["DESCRIZIONE_SINTETICA_CUP"]
    if is_present(record.get("DESCRIZIONE_INTERVENTO")):
        intervention["L0:description"] = record["DESCRIZIONE_INTERVENTO"]
    if nature_code and nature_code in NATURE_INDIVIDUAL:
        intervention["pi:ha_natura_intervento"] = {"@id": f"pi:{NATURE_INDIVIDUAL[nature_code]}"}

    cv_links = [
        ("settore", "CODICE_SETTORE_INTERVENTO", "SETTORE_INTERVENTO", "pi:ha_settore_intervento"),
        ("tipologia", "CODICE_TIPO_INTERVENTO", "TIPOLOGIA_INTERVENTO", "pi:ha_tipologia_intervento"),
        ("sottosettore", "CODICE_SOTTOSETTORE_INTERVENTO", "SOTTOSETTORE_INTERVENTO", "pi:ha_sottosettore_intervento"),
        ("categoria", "CODICE_CATEGORIA_INTERVENTO", "CATEGORIA_INTERVENTO", "pi:ha_categoria_intervento"),
        ("area", "CODICE_AREA_INTERVENTO", "AREA_INTERVENTO", "pi:ha_area_intervento"),
    ]
    for cv_type, code_field, label_field, prop in cv_links:
        concept = remember_concept(cv_type, record.get(code_field), record.get(label_field))
        if concept:
            intervention[prop] = {"@id": concept["@id"]}

    titolare = {
        "@type": ["COV:PublicOrganization", "pi:Soggetto_titolare_progetto_investimento"],
        "@id": f"{COV_DATA}{urllib.parse.quote(str(record['PIVA_CODFISCALE_SOG_TITOLARE']))}",
        "COV:taxCode": str(record["PIVA_CODFISCALE_SOG_TITOLARE"]),
    }
    if is_present(record.get("SOGGETTO_TITOLARE")):
        titolare["COV:legalName"] = record["SOGGETTO_TITOLARE"]
    if is_present(record.get("CATEGORIA_SOGGETTO")):
        titolare["COV:hasCategory"] = {
            "@type": "COV:PublicOrganizationCategory",
            "@id": f"https://w3id.org/italia/data/PublicOrganizationCategory/{urllib.parse.quote(str(record['CATEGORIA_SOGGETTO']))}",
        }

    nodes.append(project)
    nodes.append(intervention)
    nodes.append(titolare)
    nodes.extend(concepts.values())
    return nodes


def opencupNodes(this, *args):
    record = args[0] if args and isinstance(args[0], dict) and "CUP" in args[0] else this
    nodes = build_opencup_nodes(record)
    return ",\n".join(json.dumps(node, ensure_ascii=False) for node in nodes)


def apply_handlebars_template(template, data):
    compiler = Compiler()
    context = {
        "encodeURIComponent": encodeURIComponent,
        "cupUri": cupUri,
        "cvUri": cvUri,
        "if_present": if_present,
        "opencupNodes": opencupNodes,
    }
    return compiler.compile(template)(data, helpers=context)


def main():
    import sys

    if len(sys.argv) < 3:
        print("Usage: python script.py input_file.json template_file.hbs")
        return

    input_file = sys.argv[1]
    template_file = sys.argv[2]

    with open(template_file, "r") as file:
        template = file.read()

    with open(input_file, "r") as file:
        json_obj = json.load(file)
        result = apply_handlebars_template(template, json_obj)
        print(result)


if __name__ == "__main__":
    main()
