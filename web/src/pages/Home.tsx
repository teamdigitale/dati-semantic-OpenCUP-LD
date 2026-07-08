import { Link } from "react-router-dom";

const CARDS = [
  {
    to: "/mappature",
    title: "Mappature",
    desc: "Campi sorgente → proprietà PublicInvestment e punti di join semantico tra dataset.",
  },
  {
    to: "/grafi",
    title: "Grafi separati",
    desc: "Visualizza ogni dataset RDF in isolamento: OpenCUP, PA Digitale, CUPCIG, IndicePA.",
  },
  {
    to: "/unione",
    title: "Unione semantica",
    desc: "Sottografi demo che mostrano come i grafi si collegano automaticamente via URI condivisi.",
  },
  {
    to: "/analisi",
    title: "Analisi",
    desc: "Statistiche e grafici SPARQL pre-calcolati sul grafo completo.",
  },
];

export function Home() {
  return (
    <div>
      <h1>Linked Data OpenCUP — Explorer</h1>
      <p className="lead">
        Esplora le mappature RDF, i grafi per fonte dati e le connessioni semantiche
        automatiche tra PA Digitale, OpenCUP, ANAC e IndicePA.
      </p>
      <div className="card-grid">
        {CARDS.map((c) => (
          <Link key={c.to} to={c.to} className="card">
            <h2>{c.title}</h2>
            <p>{c.desc}</p>
          </Link>
        ))}
      </div>
      <section className="info-box">
        <h3>Pipeline</h3>
        <pre>{`srcdata → DuckDB filter → Handlebars templates → JSON-LD → TTL (all.ttl) → web assets`}</pre>
      </section>
    </div>
  );
}
