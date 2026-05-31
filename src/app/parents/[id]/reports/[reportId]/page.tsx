"use client";

import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  Copy,
  Download,
  FileDown,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import type { LabValue, Report } from "@/lib/db";
import type { ParsedReport, ParsedReportSource, PatternExplanation } from "@/lib/types";
import { CitedText } from "@/components/cited-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Constants ──────────────────────────────────────────────────────────────

const TL_CARD = {
  green: "bg-emerald-50 border-emerald-200",
  yellow: "bg-amber-50 border-amber-200",
  red: "bg-rose-50 border-rose-200",
} as const;

const TL_TEXT = {
  green: "text-emerald-700",
  yellow: "text-amber-700",
  red: "text-rose-700",
} as const;

const TL_DOT = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
} as const;

const TL_PILL = {
  green: "border-emerald-300 bg-emerald-100/60",
  yellow: "border-amber-300 bg-amber-100/60",
  red: "border-rose-300 bg-rose-100/60",
} as const;

const STATUS_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  low: 1,
  normal: 2,
};

// ── Types ──────────────────────────────────────────────────────────────────

type EditableValue = {
  id: string;
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: "normal" | "low" | "high" | "critical";
  userEdited: boolean;
  isNew: boolean;
  deleted: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function recomputeSummary(values: { status: string }[]) {
  const statuses = values.map((v) => v.status);
  const trafficLight: "green" | "yellow" | "red" = statuses.includes("critical")
    ? "red"
    : statuses.some((s) => s === "high" || s === "low")
    ? "yellow"
    : "green";
  return {
    trafficLight,
    abnormalCount: statuses.filter((s) => s !== "normal").length,
  };
}

function parseSources(sourcesJson?: string): ParsedReportSource[] {
  if (!sourcesJson) return [];
  try {
    return JSON.parse(sourcesJson) as ParsedReportSource[];
  } catch {
    return [];
  }
}

function buildShareText(
  parentName: string | undefined,
  report: Report,
  labValues: LabValue[]
): string {
  const abnormal = labValues.filter((lv) => lv.status !== "normal");
  const lines: string[] = [
    `${parentName ?? "Patient"} — ${report.testPanel ?? "Lab Report"}`,
    `${format(parseISO(report.reportDate), "d MMM yyyy")}${
      report.labName ? ` · ${report.labName}` : ""
    }`,
    `Status: ${report.trafficLight.toUpperCase()} — ${report.headline}`,
  ];

  if (report.patternsDetected.length > 0) {
    lines.push(`Patterns: ${report.patternsDetected.join(", ")}`);
  }

  if (abnormal.length > 0) {
    lines.push("", "Abnormal values:");
    for (const lv of abnormal) {
      let line = `${lv.name}: ${lv.value}${lv.unit ? ` ${lv.unit}` : ""}`;
      if (lv.referenceRange) line += ` (range: ${lv.referenceRange})`;
      line += ` — ${lv.status.toUpperCase()}`;
      lines.push(line);
    }
  }

  if (report.nextSteps) lines.push("", `Next steps: ${report.nextSteps}`);
  if (report.disclaimer) lines.push("", report.disclaimer);

  return lines.join("\n");
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SourcePills({ sources }: { sources: ParsedReportSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {sources.map((s, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          title={`Distance: ${s.distance.toFixed(4)}`}
        >
          {s.file} → {s.section}
        </span>
      ))}
    </div>
  );
}

function PatternCard({ pe }: { pe: PatternExplanation }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5 space-y-3">
        <p className="text-base font-semibold text-foreground">{pe.pattern}</p>
        <CitedText
          text={pe.explanation}
          className="text-sm text-muted-foreground leading-relaxed"
        />
        <SourcePills sources={pe.sources ?? []} />
      </CardContent>
    </Card>
  );
}

function ValueCard({
  lv,
  expanded,
  onToggle,
}: {
  lv: LabValue;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sources = parseSources(lv.sources);
  const isAbnormal = lv.status !== "normal";
  const hasCited = isAbnormal && !!lv.citedExplanation;

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-2">
        {/* Top row: name / value+unit */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-semibold leading-snug">{lv.name}</p>
            {lv.userEdited && (
              <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>
          <p className="font-mono text-sm shrink-0 tabular-nums">
            {lv.value}
            {lv.unit && (
              <span className="text-muted-foreground ml-1 font-sans">{lv.unit}</span>
            )}
          </p>
        </div>

        {/* Reference range + status badge */}
        <div className="flex items-center gap-2">
          {lv.referenceRange && (
            <p className="text-xs text-muted-foreground flex-1">
              ref: {lv.referenceRange}
            </p>
          )}
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ml-auto",
              `status-${lv.status}`
            )}
          >
            {lv.status}
          </span>
        </div>

        {/* Brief explanation for normal values */}
        {!isAbnormal && lv.explanation && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {lv.explanation}
          </p>
        )}

        {/* "Why this matters" expandable section for abnormals */}
        {hasCited && (
          <div className="border-t border-border/60 pt-2 mt-1">
            <button
              onClick={onToggle}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left h-8"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  expanded && "rotate-180"
                )}
              />
              Why this matters
            </button>
            {expanded && (
              <div className="mt-2 space-y-3">
                <CitedText
                  text={lv.citedExplanation!}
                  className="text-sm text-muted-foreground leading-relaxed"
                />
                <SourcePills sources={sources} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditValueCard({
  ev,
  onUpdate,
  onDelete,
}: {
  ev: EditableValue;
  onUpdate: (changes: Partial<EditableValue>) => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Test Name</Label>
            <Input
              value={ev.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g. Hemoglobin"
              className="h-10"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Value</Label>
            <Input
              value={ev.value}
              onChange={(e) => onUpdate({ value: e.target.value })}
              placeholder="e.g. 11.2"
              className="h-10"
            />
          </div>
          <div className="w-28 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unit</Label>
            <Input
              value={ev.unit}
              onChange={(e) => onUpdate({ unit: e.target.value })}
              placeholder="g/dL"
              className="h-10"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Reference Range</Label>
          <Input
            value={ev.referenceRange}
            onChange={(e) => onUpdate({ referenceRange: e.target.value })}
            placeholder="e.g. 12.0–15.5"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={ev.status}
            onValueChange={(v) =>
              onUpdate({ status: (v ?? "normal") as EditableValue["status"] })
            }
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const parentId = params.id as string;
  const reportId = params.reportId as string;

  // ── Queries ──────────────────────────────────────────────────────────────
  const report = useLiveQuery(
    async () => (await db.reports.get(reportId)) ?? null,
    [reportId]
  );
  const labValues = useLiveQuery(
    () => db.labValues.where("reportId").equals(reportId).toArray(),
    [reportId]
  );
  const parent = useLiveQuery(
    async () => (await db.parents.get(parentId)) ?? null,
    [parentId]
  );

  // ── Parsed JSON (rich pattern explanations etc.) ─────────────────────────
  const parsedReport = useMemo((): ParsedReport | null => {
    if (!report?.parsedJson) return null;
    try {
      return JSON.parse(report.parsedJson) as ParsedReport;
    } catch {
      return null;
    }
  }, [report?.parsedJson]);

  const patternExplanations = parsedReport?.summary?.pattern_explanations ?? [];

  // ── Values display ────────────────────────────────────────────────────────
  const hasAbnormals = labValues?.some((v) => v.status !== "normal") ?? false;
  const [showAll, setShowAll] = useState(false);
  const [expandedValues, setExpandedValues] = useState<Set<string>>(new Set());

  const displayValues = useMemo(() => {
    if (!labValues) return [];
    const filtered =
      showAll || !hasAbnormals
        ? labValues
        : labValues.filter((v) => v.status !== "normal");
    return [...filtered].sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2)
    );
  }, [labValues, showAll, hasAbnormals]);

  function toggleExpanded(id: string) {
    setExpandedValues((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Delete state ─────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Edit mode state ───────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<EditableValue[]>([]);
  const [saving, setSaving] = useState(false);
  const originalValuesRef = useRef<LabValue[]>([]);

  function enterEditMode() {
    const snapshot = labValues ?? [];
    originalValuesRef.current = snapshot;
    setEditValues(
      snapshot.map((lv) => ({
        id: lv.id,
        name: lv.name,
        value: lv.value,
        unit: lv.unit ?? "",
        referenceRange: lv.referenceRange ?? "",
        status: lv.status,
        userEdited: lv.userEdited,
        isNew: false,
        deleted: false,
      }))
    );
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditValues([]);
  }

  function updateEditValue(id: string, changes: Partial<EditableValue>) {
    setEditValues((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...changes, userEdited: true } : v))
    );
  }

  function deleteEditValue(id: string) {
    setEditValues((prev) =>
      prev.map((v) => (v.id === id ? { ...v, deleted: true } : v))
    );
  }

  function addEditValue() {
    setEditValues((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        value: "",
        unit: "",
        referenceRange: "",
        status: "normal",
        userEdited: true,
        isNew: true,
        deleted: false,
      },
    ]);
  }

  async function saveEdits() {
    setSaving(true);
    try {
      const active = editValues.filter((v) => !v.deleted);
      const { trafficLight, abnormalCount } = recomputeSummary(active);

      await db.transaction("rw", [db.reports, db.labValues], async () => {
        for (const ev of editValues.filter((v) => v.deleted && !v.isNew)) {
          await db.labValues.delete(ev.id);
        }
        for (const ev of active) {
          if (ev.isNew) {
            if (!ev.name.trim()) continue;
            await db.labValues.add({
              id: ev.id,
              reportId,
              name: ev.name.trim(),
              value: ev.value,
              unit: ev.unit || undefined,
              referenceRange: ev.referenceRange || undefined,
              status: ev.status,
              userEdited: true,
            });
          } else {
            const orig = originalValuesRef.current.find((o) => o.id === ev.id);
            const changed =
              !orig ||
              ev.name.trim() !== orig.name ||
              ev.value !== orig.value ||
              (ev.unit || undefined) !== orig.unit ||
              (ev.referenceRange || undefined) !== orig.referenceRange ||
              ev.status !== orig.status;
            await db.labValues.update(ev.id, {
              name: ev.name.trim(),
              value: ev.value,
              unit: ev.unit || undefined,
              referenceRange: ev.referenceRange || undefined,
              status: ev.status,
              userEdited: changed ? true : (orig?.userEdited ?? false),
            });
          }
        }
        await db.reports.update(reportId, { trafficLight, abnormalCount });
      });

      setEditMode(false);
      setEditValues([]);
      toast.success("Changes saved");
    } catch (e) {
      console.error("Save failed:", e);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  // ── Share / export handlers ──────────────────────────────────────────────
  function handleCopyText() {
    if (!report || !labValues) return;
    const text = buildShareText(parent?.name, report, labValues);
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Could not copy to clipboard"));
  }

  async function handleWebShare() {
    if (!report || !labValues) return;
    const text = buildShareText(parent?.name, report, labValues);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${parent?.name ?? "Patient"} Lab Report`, text });
      } catch (e) {
        if ((e as Error).name !== "AbortError") toast.error("Share failed");
      }
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() => toast.success("Copied to clipboard"))
        .catch(() => toast.error("Could not copy to clipboard"));
    }
  }

  async function handlePdfDownload() {
    if (!report || !labValues) return;
    const loadingToast = toast.loading("Generating PDF…");
    try {
      const [{ pdf }, { ReportPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/ReportPdf"),
      ]);
      const blob = await pdf(
        <ReportPdfDocument
          parentName={parent?.name ?? "Patient"}
          report={report}
          labValues={labValues}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ParentCare_${(parent?.name ?? "Report").replace(/\s+/g, "_")}_${report.reportDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error("PDF generation failed:", e);
      toast.error("Could not generate PDF. Try copying as text instead.");
    } finally {
      toast.dismiss(loadingToast);
    }
  }

  function handleOriginalDownload() {
    if (!report?.originalFileBlob || !report.originalFileName) return;
    const url = URL.createObjectURL(report.originalFileBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = report.originalFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    try {
      await db.transaction("rw", [db.reports, db.labValues], async () => {
        await db.labValues.where("reportId").equals(reportId).delete();
        await db.reports.delete(reportId);
      });
      toast.success("Report deleted");
      router.replace(`/parents/${parentId}`);
    } catch {
      toast.error("Failed to delete report");
    }
  }

  // ── Loading / not-found ──────────────────────────────────────────────────
  if (report === undefined || labValues === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (report === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Report not found.</p>
        <Button onClick={() => router.replace(`/parents/${parentId}`)}>Go back</Button>
      </div>
    );
  }

  const tl = report.trafficLight;
  const activeEditValues = editValues.filter((v) => !v.deleted);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex h-14 items-center justify-between px-3">
          {editMode ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={cancelEdit}
              >
                <X className="h-5 w-5" />
              </Button>
              <span className="font-semibold text-base flex-1 text-center">Edit Values</span>
              <div className="w-11 shrink-0" />
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                className="gap-1 px-2 h-11 text-muted-foreground hover:text-foreground"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm">Back</span>
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={enterEditMode}
                  aria-label="Edit values"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none"
                    aria-label="Share"
                  >
                    <Share2 className="h-5 w-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    <DropdownMenuItem onClick={handleCopyText}>
                      <Copy className="h-4 w-4" />
                      Copy summary as text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleWebShare}>
                      <Share2 className="h-4 w-4" />
                      Share via WhatsApp / Mail…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handlePdfDownload}>
                      <FileDown className="h-4 w-4" />
                      Download as PDF
                    </DropdownMenuItem>
                    {report.originalFileBlob && (
                      <DropdownMenuItem onClick={handleOriginalDownload}>
                        <Download className="h-4 w-4" />
                        Download original file
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </>
          )}
        </div>
      </header>

      <main
        className={cn(
          "flex-1 px-4 py-6 space-y-6",
          editMode ? "pb-28" : "pb-16"
        )}
        style={{ paddingBottom: editMode ? undefined : "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        {/* ── A. Header card ────────────────────────────────────────────── */}
        {!editMode && (
          <Card className={cn("rounded-2xl border-2", TL_CARD[tl])}>
            <CardContent className="p-5 space-y-3">
              {/* Traffic light pill + headline */}
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold",
                  TL_PILL[tl],
                  TL_TEXT[tl]
                )}
              >
                <span className={cn("h-2 w-2 rounded-full shrink-0", TL_DOT[tl])} />
                {report.headline}
              </div>
              {/* Test panel */}
              <h1
                className={cn(
                  "text-2xl font-semibold tracking-tight leading-snug",
                  TL_TEXT[tl]
                )}
              >
                {report.testPanel ?? "Lab Report"}
              </h1>
              {/* Meta row */}
              <p className={cn("text-sm opacity-70", TL_TEXT[tl])}>
                {[
                  report.labName,
                  format(parseISO(report.reportDate), "d MMM yyyy"),
                  `${report.abnormalCount} abnormal of ${labValues.length} value${labValues.length !== 1 ? "s" : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── B. Patterns section ───────────────────────────────────────── */}
        {!editMode && (
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">
              Patterns Detected
            </h2>
            {patternExplanations.length > 0 ? (
              <div className="flex flex-col gap-3">
                {patternExplanations.map((pe, i) => (
                  <PatternCard key={i} pe={pe} />
                ))}
              </div>
            ) : report.patternsDetected.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {report.patternsDetected.map((p, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm"
                  >
                    {p}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No patterns flagged.</p>
            )}
          </section>
        )}

        {/* ── C. Values section ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-lg font-semibold tracking-tight shrink-0">
              {editMode ? "Values" : "All Values"}
            </h2>
            {!editMode && hasAbnormals && (
              <div className="flex items-center rounded-xl border bg-muted/60 p-0.5 gap-0.5">
                <button
                  onClick={() => setShowAll(false)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-lg font-medium transition-all",
                    !showAll
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  Abnormal only
                </button>
                <button
                  onClick={() => setShowAll(true)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-lg font-medium transition-all",
                    showAll
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  Show all
                </button>
              </div>
            )}
          </div>

          {editMode ? (
            <div className="flex flex-col gap-3">
              {activeEditValues.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No values. Use the button below to add one.
                </p>
              ) : (
                activeEditValues.map((ev) => (
                  <EditValueCard
                    key={ev.id}
                    ev={ev}
                    onUpdate={(changes) => updateEditValue(ev.id, changes)}
                    onDelete={() => deleteEditValue(ev.id)}
                  />
                ))
              )}
              <Button variant="outline" className="h-11 mt-1" onClick={addEditValue}>
                <Plus className="h-4 w-4 mr-2" />
                Add value
              </Button>
            </div>
          ) : labValues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No values recorded.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {displayValues.map((lv) => (
                <ValueCard
                  key={lv.id}
                  lv={lv}
                  expanded={expandedValues.has(lv.id)}
                  onToggle={() => toggleExpanded(lv.id)}
                />
              ))}
              {!showAll && hasAbnormals && labValues.length > displayValues.length && (
                <button
                  onClick={() => setShowAll(true)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center py-2"
                >
                  + {labValues.length - displayValues.length} normal value
                  {labValues.length - displayValues.length !== 1 ? "s" : ""} hidden
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── D. Next steps ─────────────────────────────────────────────── */}
        {!editMode && report.nextSteps && (
          <section>
            <h2 className="text-lg font-semibold tracking-tight mb-3">Next Steps</h2>
            <Card className="rounded-2xl bg-accent border-accent">
              <CardContent className="p-5">
                <p className="text-sm leading-relaxed text-accent-foreground">
                  {report.nextSteps}
                </p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Remind me ─────────────────────────────────────────────────── */}
        {!editMode && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl"
            onClick={() => {
              const title = encodeURIComponent(
                `Repeat ${report.testPanel ?? "tests"} for ${parent?.name ?? "parent"}`
              );
              router.push(`/parents/${parentId}/reminders/new?title=${title}`);
            }}
          >
            <Bell className="h-4 w-4 mr-2" />
            Remind me to repeat these tests
          </Button>
        )}

        {/* ── E. Cost + disclaimer ──────────────────────────────────────── */}
        {!editMode && (
          <div className="space-y-3 border-t pt-4">
            {report.parseCostInr != null && (
              <p className="text-xs text-muted-foreground">
                Parsed using the medical reference corpus · RAG enrichment cost: ~₹
                {report.parseCostInr.toFixed(2)}
              </p>
            )}
            {report.disclaimer && (
              <p className="text-xs text-muted-foreground/70 italic leading-relaxed">
                {report.disclaimer}
              </p>
            )}
          </div>
        )}
      </main>

      {/* ── Sticky save bar (edit mode) ───────────────────────────────────── */}
      {editMode && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t px-4 pt-3 flex gap-3"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={cancelEdit}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-12 rounded-xl"
            onClick={saveEdits}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      )}

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this report?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the report and all its values. This cannot be
            undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-12 rounded-xl"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-12 rounded-xl"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
