import { useMemo } from "react";
import { parseResumeMarkdown, inlineMdToHtml } from "../utils/parseResume";

function EntryHeaderRow({ entry }) {
  const parts = (entry.parts || []).filter((p) => p !== "");
  let title = "";
  let dates = "";
  let middle = [];

  if (parts.length >= 2) {
    title = parts[0];
    dates = parts[parts.length - 1];
    middle = parts.slice(1, -1);
  } else if (parts.length === 1) {
    title = parts[0];
  }

  return (
    <>
      <div className="entry-header-row">
        <span
          className="entry-title"
          dangerouslySetInnerHTML={{ __html: inlineMdToHtml(title) }}
        />
        <span
          className="entry-date"
          dangerouslySetInnerHTML={{ __html: inlineMdToHtml(dates) }}
        />
      </div>
      {middle.length > 0 && (
        <div
          className="entry-subtitle"
          dangerouslySetInnerHTML={{ __html: inlineMdToHtml(middle.join(", ")) }}
        />
      )}
    </>
  );
}

function ListItem({ item }) {
  if (item.includes(":")) {
    const idx = item.indexOf(":");
    const label = item.slice(0, idx);
    const rest = item.slice(idx + 1);
    return (
      <li>
        <b dangerouslySetInnerHTML={{ __html: inlineMdToHtml(label.trim()) }} />
        {":"}
        <span dangerouslySetInnerHTML={{ __html: inlineMdToHtml(rest) }} />
      </li>
    );
  }
  return <li dangerouslySetInnerHTML={{ __html: inlineMdToHtml(item) }} />;
}

export default function ResumePreview({ markdown }) {
  const data = useMemo(() => parseResumeMarkdown(markdown), [markdown]);

  return (
    <div className="preview-pane">
      <div className="pane-header">Live Preview</div>
      <div className="resume-paper">
        {data.name && <h1 className="resume-name">{data.name}</h1>}
        {data.contact && (
          <p
            className="resume-contact"
            dangerouslySetInnerHTML={{ __html: inlineMdToHtml(data.contact) }}
          />
        )}
        <hr className="rule-heavy" />

        {data.sections.map((section, i) => (
          <div key={i} className="resume-section">
            <h2 className="section-heading">{section.heading}</h2>
            <hr className="rule-light" />

            {section.type === "entries" &&
              section.entries.map((entry, j) => (
                <div key={j} className="entry-block">
                  <EntryHeaderRow entry={entry} />
                  {entry.bullets.length > 0 && (
                    <ul className="bullet-list">
                      {entry.bullets.map((b, k) => (
                        <li
                          key={k}
                          dangerouslySetInnerHTML={{ __html: inlineMdToHtml(b) }}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              ))}

            {section.type === "list" && (
              <ul className="bullet-list">
                {section.items.map((item, j) => (
                  <ListItem key={j} item={item} />
                ))}
              </ul>
            )}

            {section.type === "text" && (
              <p
                className="section-text"
                dangerouslySetInnerHTML={{ __html: inlineMdToHtml(section.content) }}
              />
            )}
          </div>
        ))}

        {data.sections.length === 0 && !data.name && (
          <p className="preview-empty">Start typing your resume markdown on the left…</p>
        )}
      </div>
    </div>
  );
}
