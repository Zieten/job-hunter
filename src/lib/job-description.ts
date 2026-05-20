import * as cheerio from "cheerio";

// Job descriptions arrive in mixed shapes: aggregators (JSearch, Indeed) return
// HTML; some ATS scrapers return plain text or light markdown. The detail page
// was rendering HTML as raw escaped text. This helper detects HTML, strips it
// down to a safe structural subset, and returns clean markup for rendering —
// or falls back to plain text for non-HTML content.

type Sanitized = { html: string | null; text: string };

const DANGEROUS = "script, style, iframe, object, embed, link, meta, noscript, form, input, button";

export function sanitizeJobDescription(raw: string | null | undefined): Sanitized {
  const content = (raw ?? "").trim();
  if (!content) return { html: null, text: "" };

  // Heuristic: does it contain real HTML tags?
  const looksHtml = /<\/?[a-z][^>]*>/i.test(content);
  if (!looksHtml) return { html: null, text: content };

  const $ = cheerio.load(content, null, false);

  // Drop anything that could execute or break layout.
  $(DANGEROUS).remove();

  // Strip every attribute except safe href on <a>; drop javascript: URLs.
  $("*").each((_, el) => {
    const e = el as unknown as { name?: string; attribs?: Record<string, string> };
    if (!e.attribs) return;
    for (const name of Object.keys(e.attribs)) {
      const isSafeHref =
        e.name === "a" &&
        name === "href" &&
        !/^\s*javascript:/i.test(e.attribs[name] ?? "");
      if (!isSafeHref) delete e.attribs[name];
    }
  });

  const html = $.html().trim();
  const text = $.root().text().replace(/[ \t]+\n/g, "\n").trim();
  return { html: html || null, text: text || content };
}
