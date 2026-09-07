import { Link } from "react-router-dom";
import { ContentMarkdown } from "../components/ContentMarkdown";
import { parseMarkdown, parseYaml, splitSections } from "../content/load";
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
  title: string;
  description: string;
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

export function Home() {
  return (
    <div>
      <div className="row mb-4">
        <div className="col-12">
          {typeof homeMeta.eyebrow === "string" && (
            <p className="text-secondary mb-1">{homeMeta.eyebrow}</p>
          )}
          <h1>{String(homeMeta.title ?? "OpenCUP LD")}</h1>
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
          {sourcesDoc.sources.map((s) => (
            <div className="col-12 col-md-6" key={s.title}>
              <div className="card-wrapper card-space h-100">
                <div className="card card-bg h-100">
                  <div className="card-body">
                    <h3 className="h5 card-title">{s.title}</h3>
                    <p className="card-text mb-0">{s.description}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {sourcesDoc.sources_note && (
          <div className="mt-3 text-secondary">
            <ContentMarkdown source={sourcesDoc.sources_note} />
          </div>
        )}
      </section>

      {sections.compare && (
        <section className="mb-5">
          <ContentMarkdown source={sections.compare} />
        </section>
      )}

      {sections.citizen && (
        <section className="mb-5">
          <ContentMarkdown source={sections.citizen} />
        </section>
      )}

      {sections.pipeline && (
        <section className="mb-5">
          <ContentMarkdown source={sections.pipeline} />
          <div className="accordion" id="accordionLdDetail">
            <div className="accordion-item">
              <h3 className="accordion-header" id="headingReshape">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#collapseReshape"
                  aria-expanded="false"
                  aria-controls="collapseReshape"
                >
                  Dettaglio tecnico del reshape
                </button>
              </h3>
              <div
                id="collapseReshape"
                className="accordion-collapse collapse"
                aria-labelledby="headingReshape"
                data-bs-parent="#accordionLdDetail"
              >
                <div className="accordion-body">
                  <ul>
                    <li>
                      Assegnare <code>@id</code> stabili (CUP, Lot, Award, Notice, IPA, CF).
                    </li>
                    <li>
                      Dichiarare <code>@type</code> ontologici (es.{" "}
                      <code>pi:Progetto_di_investimento_pubblico</code>,{" "}
                      <code>PCTR:Lot</code>, <code>PCTR:Award</code>).
                    </li>
                    <li>
                      Per OpenCUP: blank node dell&apos;intervento, URI dei CV SKOS.
                    </li>
                    <li>
                      IndicePA: <code>owl:sameAs</code> tra ente IPA e CF del titolare.
                    </li>
                    <li>
                      SCP: stesso <code>Lot/{"{cig}"}</code> di ANAC + Award / ContractNotice.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {sections.jsonld && (
        <section className="mb-5">
          <ContentMarkdown source={sections.jsonld} />
          <div className="ld-compare">
            <div>
              <h3 className="h5">JSON piatto (ANAC)</h3>
              <pre>{JSON.stringify(FLAT_CUPCIG, null, 2)}</pre>
            </div>
            <div>
              <h3 className="h5">JSON-LD (reshape + context)</h3>
              <pre>{JSON.stringify(JSONLD_CUPCIG, null, 2)}</pre>
            </div>
          </div>
          <p className="text-secondary mt-2 mb-0">
            Prova locale:{" "}
            <code>uv run python LD/scripts/convert_cupcig_jsonld.py --spike</code>
          </p>
        </section>
      )}

      {sections.uri && (
        <section className="mb-5">
          <ContentMarkdown source={sections.uri} />
        </section>
      )}

      {sections.limits && (
        <section className="mb-5">
          <ContentMarkdown source={sections.limits} />
          <pre className="story-pipeline mt-3">{`srcdata raw
  → analytics full (territorio, stati, aggiudicazioni)
  → filtro hub + SCP → Award/Notice RDF
  → reshape + @context
  → JSON-LD → Turtle (all.ttl)
  → web: racconto + campioni + analisi`}</pre>
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
                      <span className="text">Apri</span>
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
