import mammoth from "mammoth";

// Extract plain text from an uploaded CV (PDF or DOCX).
export async function extractCvText(buf: Buffer, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  }
  if (lower.endsWith(".pdf")) {
    return await extractPdfText(buf);
  }
  return buf.toString("utf8");
}

async function extractPdfText(buf: Buffer): Promise<string> {
  // unpdf is built for serverless/Node and avoids pdfjs-dist's worker issues.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}
