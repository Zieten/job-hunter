import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } from "docx";
import type { TailoredCVStructure } from "@/lib/types";

export async function renderCVtoDocx(cv: TailoredCVStructure): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      children: [new TextRun({ text: cv.fullName, bold: true, size: 36 })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: cv.headline, color: "555555", size: 22 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: [
            cv.contact.email,
            cv.contact.phone,
            cv.contact.location,
            cv.contact.linkedin,
            cv.contact.website,
          ]
            .filter(Boolean)
            .join("  •  "),
          color: "666666",
          size: 18,
        }),
      ],
      spacing: { after: 240 },
    }),
  );

  sectionHeading(children, "Summary");
  children.push(new Paragraph({ children: [new TextRun(cv.summary)], spacing: { after: 200 } }));

  sectionHeading(children, "Skills");
  for (const s of cv.skills) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${s.category}: `, bold: true }),
          new TextRun(s.items.join(", ")),
        ],
        spacing: { after: 60 },
      }),
    );
  }

  sectionHeading(children, "Experience");
  for (const x of cv.experience) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${x.role} — ${x.company}`, bold: true }),
          new TextRun({
            text: `   ${x.start} – ${x.end ?? "Present"}${x.location ? `  •  ${x.location}` : ""}`,
            color: "666666",
          }),
        ],
        spacing: { before: 120, after: 60 },
      }),
    );
    for (const b of x.bullets) {
      children.push(
        new Paragraph({
          text: b,
          bullet: { level: 0 },
          spacing: { after: 40 },
        }),
      );
    }
  }

  if (cv.education.length) {
    sectionHeading(children, "Education");
    for (const e of cv.education) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: e.school, bold: true }),
            new TextRun({
              text: `   ${e.start ?? ""}${e.end ? ` – ${e.end}` : ""}`,
              color: "666666",
            }),
          ],
        }),
        new Paragraph({ text: e.degree, spacing: { after: 100 } }),
      );
    }
  }

  if (cv.projects?.length) {
    sectionHeading(children, "Projects");
    for (const p of cv.projects) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: p.name, bold: true })] }),
        new Paragraph({ text: p.description, spacing: { after: 40 } }),
      );
      if (p.tech?.length) {
        children.push(new Paragraph({ text: `Tech: ${p.tech.join(", ")}`, spacing: { after: 100 } }));
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBuffer(doc);
}

function sectionHeading(children: Paragraph[], title: string) {
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 22 })],
      spacing: { before: 200, after: 80 },
    }),
  );
}
