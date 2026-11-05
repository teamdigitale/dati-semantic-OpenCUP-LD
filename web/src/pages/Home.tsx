import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ContentMarkdown } from "../components/ContentMarkdown";
import { parseMarkdown, parseYaml, splitSections } from "../content/load";
import { site } from "../content/site";
import { fetchJson } from "../api";
import homeRaw from "../../content/home.md?raw";
import sourcesRaw from "../../content/home.sources.yml?raw";
import exploreRaw from "../../content/home.explore.yml?raw";

const FLAT_CUPCIG = [
  { CIG: "9467132C76", CUP: "E31C22001170006" },
  { CIG: "998570721A", CUP: "C61F22001090006" },
];

const JSONLD_CUPCIG = {
  "@context": {
    pi: "https://w3id.org/italia/PublicInvestment/onto/PublicInvestment/",
    PCTR: "https://w3id.org/italia/onto/PublicContract/",
  },
  "@graph": [
    {
      "@id": "https://w3id.org/italia/data/Lot/9467132C76",
      "@type": "PCTR:Lot",
      "PCTR:hasProject": {
        "@id": "https://w3id.org/italia/PublicInvestment/data/CUP/E31C22001170006",
        "@type": "pi:Progetto_di_investimento_pubblico",
      },
    },
  ],
};

interface SourceCard {
  id?: string;
  title: string;
  description: string;
}

interface ProvenanceSource {
  id: string;
  title: string;
  publisher?: string;
  updated_at?: string | null;
  present?: boolean;
}

interface ExploreItem {
  to: string;
  title: string;
  description: string;
}

const { data: homeMeta, content: homeBody } = parseMarkdown(homeRaw);
const sections = splitSections(homeBody);
const sourcesDoc = parseYaml<{ sources: SourceCard[]; sources_note: string }>(sourcesRaw);
const exploreDoc = parseYaml<{ items: ExploreItem[] }>(exploreRaw);

function formatUpdated(iso?: string | null): string {
  if (!iso) return "data n.d.";
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "data n.d.";
  }
}

export function Home() {
  const [prov, setProv] = useState<Record<string, ProvenanceSource>>({});

  useEffect(() => {
    fetchJson<{ sources: ProvenanceSource[] }>("sources.json")
      .then((d) => {
        const map: Record<string, ProvenanceSource> = {};
        for (const s of d.sources || []) map[s.id] = s;
        setProv(map);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <div className="row mb-4">
        <div className="col-12">
          {typeof homeMeta.eyebrow === "string" && (
            <p className="text-secondary mb-1">{homeMeta.eyebrow}</p>
          )}
          <h1>{String(homeMeta.title ?? site.brand.title)}</h1>
          {typeof homeMeta.lead === "string" && (
            <p className="lead">{homeMeta.lead}</p>
          )}
        </div>
      </div>

      {sections.main && <ContentMarkdown source={sections.main} />}
      {sections.why && (
        <section className="mb-5">
          <ContentMarkdown source={sections.why} />
        </section>
      )}

      <section className="mb-5">
        {sections["sources-intro"] && (
          <ContentMarkdown source={sections["sources-intro"]} />
        )}
        <div className="row g-3">
          {sourcesDoc.sources.map((s) => {
            const meta = s.id ? prov[s.id] : undefined;
            return (
              <div className="col-12 col-md-6 col-lg-4" key={s.title}>
                <div className="card-wrapper card-space h-100">
                  <div className="card card-bg h-100">
                    <div className="card-body">
                      <h3 className="h5 card-title">{s.title}</h3>
                      <p className="card-text">{s.description}</p>
                      <p className="small text-secondary mb-0">
                        {meta?.publisher ? `${meta.publisher} · ` : ""}
                        aggiornato {formatUpdated(meta?.updated_at)}
                        {meta?.present === false ? " · file assente" : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {sourcesDoc.sources_note && (
          <div className="mt-3 text-secondary">
            <ContentMarkdown source={sourcesDoc.sources_note} />
          </div>
        )}
        <p className="mt-2 mb-0">
          <Link to="/fonti">Catalogo completo fonti e candidati →</Link>
        </p>
      </section>

      {sections.citizen && (
        <section className="mb-5">
          <ContentMarkdown source={sections.citizen} />
        </section>
      )}

      {sections.jsonld && (
        <section className="mb-5">
          <ContentMarkdown source={sections.jsonld} />
          <div className="ld-compare">
            <div>
              <h3 className="h5">{String(homeMeta.json_flat_title)}</h3>
              <pre>{JSON.stringify(FLAT_CUPCIG, null, 2)}</pre>
            </div>
            <div>
              <h3 className="h5">{String(homeMeta.jsonld_title)}</h3>
              <pre>{JSON.stringify(JSONLD_CUPCIG, null, 2)}</pre>
            </div>
          </div>
        </section>
      )}

      {sections.uri && (
        <section className="mb-5">
          <ContentMarkdown source={sections.uri} />
        </section>
      )}

      <section>
        {sections.explore && <ContentMarkdown source={sections.explore} />}
        <div className="row g-3">
          {exploreDoc.items.map((item) => (
            <div className="col-12 col-md-6 col-lg-4" key={item.to}>
              <div className="card-wrapper card-space h-100">
                <div className="card card-bg card-big h-100">
                  <div className="card-body">
                    <h3 className="card-title h5">
                      <Link to={item.to}>{item.title}</Link>
                    </h3>
                    <p className="card-text">{item.description}</p>
                    <Link className="read-more" to={item.to}>
                      <span className="text">{site.cta.detail}</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
