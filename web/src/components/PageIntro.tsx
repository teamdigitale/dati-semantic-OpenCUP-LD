import { ContentMarkdown } from "./ContentMarkdown";
import { parseMarkdown } from "../content/load";

/** Title + lead (+ optional callout) from a content/*.md frontmatter file. */
export function PageIntro({ raw }: { raw: string }) {
  const { data, content } = parseMarkdown(raw);
  const title = String(data.title ?? "");
  const lead = typeof data.lead === "string" ? data.lead : "";
  const calloutTitle =
    typeof data.callout_title === "string" ? data.callout_title : null;
  const calloutBody =
    typeof data.callout_body === "string" ? data.callout_body : null;

  return (
    <>
      {title && <h1>{title}</h1>}
      {lead && (
        <div className="lead">
          <ContentMarkdown source={lead} />
        </div>
      )}
      {calloutTitle && calloutBody && (
        <div className="callout callout-primary mb-4">
          <div className="callout-title">
            <span className="text">{calloutTitle}</span>
          </div>
          <ContentMarkdown source={calloutBody} />
        </div>
      )}
      {content.trim() && <ContentMarkdown source={content} />}
    </>
  );
}
