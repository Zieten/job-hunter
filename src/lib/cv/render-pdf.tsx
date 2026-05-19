import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import type { TailoredCVStructure } from "@/lib/types";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 36, lineHeight: 1.4, color: "#111" },
  name: { fontSize: 22, fontWeight: 700, marginBottom: 2 },
  headline: { fontSize: 11, color: "#444", marginBottom: 6 },
  contactRow: { fontSize: 9, color: "#555", marginBottom: 14 },
  section: { marginTop: 12, marginBottom: 4 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    paddingBottom: 2,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  summary: { fontSize: 10, marginBottom: 4 },
  jobBlock: { marginBottom: 8 },
  jobHeader: { flexDirection: "row", justifyContent: "space-between" },
  jobRole: { fontWeight: 700, fontSize: 10.5 },
  jobMeta: { fontSize: 9, color: "#555" },
  bullet: { fontSize: 10, marginLeft: 10, marginBottom: 2 },
  skillsRow: { fontSize: 10, marginBottom: 2 },
  skillCat: { fontWeight: 700 },
});

export function CVDocument({ cv }: { cv: TailoredCVStructure }) {
  const contactBits = [
    cv.contact.email,
    cv.contact.phone,
    cv.contact.location,
    cv.contact.linkedin,
    cv.contact.website,
  ].filter(Boolean);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{cv.fullName}</Text>
        <Text style={styles.headline}>{cv.headline}</Text>
        <Text style={styles.contactRow}>{contactBits.join("  •  ")}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.summary}>{cv.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          {cv.skills.map((s, i) => (
            <Text style={styles.skillsRow} key={i}>
              <Text style={styles.skillCat}>{s.category}: </Text>
              {s.items.join(", ")}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {cv.experience.map((x, i) => (
            <View style={styles.jobBlock} key={i}>
              <View style={styles.jobHeader}>
                <Text style={styles.jobRole}>
                  {x.role} — {x.company}
                </Text>
                <Text style={styles.jobMeta}>
                  {x.start} – {x.end ?? "Present"}
                  {x.location ? `  •  ${x.location}` : ""}
                </Text>
              </View>
              {x.bullets.map((b, j) => (
                <Text style={styles.bullet} key={j}>
                  •  {b}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {cv.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {cv.education.map((e, i) => (
              <View style={styles.jobBlock} key={i}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobRole}>{e.school}</Text>
                  <Text style={styles.jobMeta}>
                    {e.start ?? ""} {e.end ? `– ${e.end}` : ""}
                  </Text>
                </View>
                <Text style={styles.bullet}>{e.degree}</Text>
              </View>
            ))}
          </View>
        )}

        {cv.projects && cv.projects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
            {cv.projects.map((p, i) => (
              <View style={styles.jobBlock} key={i}>
                <Text style={styles.jobRole}>{p.name}</Text>
                <Text style={styles.bullet}>{p.description}</Text>
                {p.tech && p.tech.length > 0 && (
                  <Text style={styles.bullet}>Tech: {p.tech.join(", ")}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function renderCVtoPdf(cv: TailoredCVStructure): Promise<Buffer> {
  return await renderToBuffer(<CVDocument cv={cv} />);
}
