import { resolveHref, tokenizeRdfMapping } from "../utils/uri";

interface Props {
  value: string;
  className?: string;
  /** Mostra l'URI completo invece del valore compatto. */
  full?: boolean;
}

export function ResourceLink({ value, className, full = false }: Props) {
  const href = resolveHref(value);
  if (!href) {
    return <code className={className}>{value}</code>;
  }
  const label = full ? href : value;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? `resource-link ${className}` : "resource-link"}
      title={href}
    >
      <code>{label}</code>
    </a>
  );
}

interface MappingProps {
  value: string;
}

/** Testo di mapping con termini RDF prefissati resi cliccabili. */
export function RdfMappingText({ value }: MappingProps) {
  const tokens = tokenizeRdfMapping(value);
  return (
    <>
      {tokens.map((t, i) =>
        t.href ? (
          <ResourceLink key={i} value={t.text} />
        ) : (
          <span key={i}>{t.text}</span>
        )
      )}
    </>
  );
}
