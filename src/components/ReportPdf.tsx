// Only ever imported dynamically on the client — never executed server-side.
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { LabValue, Report } from "@/lib/db";

interface ReportPdfProps {
  parentName: string;
  report: Pick<
    Report,
    | "reportDate"
    | "labName"
    | "testPanel"
    | "trafficLight"
    | "headline"
    | "patternsDetected"
    | "nextSteps"
    | "disclaimer"
  >;
  labValues: Pick<
    LabValue,
    "name" | "value" | "unit" | "referenceRange" | "status" | "explanation"
  >[];
}

const TL_COLOR = {
  green: "#16a34a",
  yellow: "#d97706",
  red: "#dc2626",
} as const;

const TL_BG = {
  green: "#dcfce7",
  yellow: "#fef3c7",
  red: "#fee2e2",
} as const;

const STATUS_COLOR: Record<string, string> = {
  normal: "#374151",
  low: "#2563eb",
  high: "#d97706",
  critical: "#dc2626",
};

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#111827" },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 18, marginBottom: 2 },
  sub: { fontSize: 9, color: "#6b7280", marginBottom: 2 },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
    marginTop: 8,
  },
  badgeTxt: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  headline: { fontSize: 11, marginBottom: 16, lineHeight: 1.4 },
  sh: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  sec: { marginBottom: 16 },
  bullet: { marginBottom: 3 },
  tableHdr: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    padding: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  c1: { flex: 2 },
  c2: { flex: 1 },
  c3: { flex: 2 },
  c4: { flex: 1 },
  bold: { fontFamily: "Helvetica-Bold" },
  nextSt: {
    backgroundColor: "#fffbeb",
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
  },
  disc: {
    fontSize: 8,
    color: "#9ca3af",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
});

export function ReportPdfDocument({
  parentName,
  report,
  labValues,
}: ReportPdfProps) {
  const tl = report.trafficLight;
  const tlLabel =
    tl === "green"
      ? "All Clear"
      : tl === "yellow"
      ? "Review Needed"
      : "Attention Required";

  return (
    <Document title={`${parentName} — Lab Report`}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.h1}>{parentName}</Text>
        {report.testPanel ? <Text style={s.sub}>{report.testPanel}</Text> : null}
        <Text style={s.sub}>
          {report.reportDate}
          {report.labName ? `  ·  ${report.labName}` : ""}
        </Text>

        {/* Traffic light badge */}
        <View style={[s.badge, { backgroundColor: TL_BG[tl] }]}>
          <Text style={[s.badgeTxt, { color: TL_COLOR[tl] }]}>{tlLabel}</Text>
        </View>
        <Text style={s.headline}>{report.headline}</Text>

        {/* Patterns */}
        {report.patternsDetected.length > 0 ? (
          <View style={s.sec}>
            <Text style={s.sh}>Patterns Detected</Text>
            {report.patternsDetected.map((p, i) => (
              <Text key={i} style={s.bullet}>
                • {p}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Lab values table */}
        <View style={s.sec}>
          <Text style={s.sh}>Lab Values</Text>
          <View style={s.tableHdr}>
            <Text style={[s.c1, s.bold]}>Test</Text>
            <Text style={[s.c2, s.bold]}>Result</Text>
            <Text style={[s.c3, s.bold]}>Reference Range</Text>
            <Text style={[s.c4, s.bold]}>Status</Text>
          </View>
          {labValues.map((lv, i) => (
            <View
              key={i}
              style={[
                s.tableRow,
                lv.status !== "normal" ? { backgroundColor: "#fffbeb" } : {},
              ]}
            >
              <Text style={s.c1}>{lv.name}</Text>
              <Text style={s.c2}>
                {lv.value}
                {lv.unit ? ` ${lv.unit}` : ""}
              </Text>
              <Text style={s.c3}>{lv.referenceRange ?? "—"}</Text>
              <Text
                style={[
                  s.c4,
                  {
                    color: STATUS_COLOR[lv.status] ?? "#111827",
                    fontFamily:
                      lv.status !== "normal"
                        ? "Helvetica-Bold"
                        : "Helvetica",
                  },
                ]}
              >
                {lv.status}
              </Text>
            </View>
          ))}
        </View>

        {/* Next steps */}
        {report.nextSteps ? (
          <View style={s.nextSt}>
            <Text
              style={[s.sh, { borderBottomColor: "#fcd34d", marginBottom: 6 }]}
            >
              Next Steps
            </Text>
            <Text style={{ lineHeight: 1.4 }}>{report.nextSteps}</Text>
          </View>
        ) : null}

        {/* Disclaimer */}
        {report.disclaimer ? (
          <Text style={s.disc}>{report.disclaimer}</Text>
        ) : null}

        {/* Page footer */}
        <Text style={s.footer} fixed>
          Generated by ParentCare · {new Date().toLocaleDateString("en-IN")}
        </Text>
      </Page>
    </Document>
  );
}
