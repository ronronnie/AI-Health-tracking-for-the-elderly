"use client";

import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Bell,
  Copy,
  Download,
  FileDown,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import type { LabValue, Report } from "@/lib/db";
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

const TRAFFIC_LIGHT_STYLES = {
  green: "bg-green-100 text-green-700 border-green-200",
  yellow: "bg-amber-100 text-amber-700 border-amber-200",
  red: "bg-red-100 text-red-700 border-red-200",
} as const;

const STATUS_BADGE: Record<string, string> = {
  normal: "bg-green-50 text-green-700 border-green-200",
  low: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-red-50 text-red-700 border-red-200",
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

// ── Edit value card sub-component ─────────────────────────────────────────

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
        {/* Name row */}
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
            aria-label="Delete value"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Value + Unit */}
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

        {/* Reference range */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Reference Range</Label>
          <Input
            value={ev.referenceRange}
            onChange={(e) => onUpdate({ referenceRange: e.target.value })}
            placeholder="e.g. 12.0–15.5"
            className="h-10"
          />
        </div>

        {/* Status */}
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
      prev.map((v) =>
        v.id === id ? { ...v, ...changes, userEdited: true } : v
      )
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
        // Delete removed values
        for (const ev of editValues.filter((v) => v.deleted && !v.isNew)) {
          await db.labValues.delete(ev.id);
        }

        for (const ev of active) {
          if (ev.isNew) {
            if (!ev.name.trim()) continue; // skip blank placeholder rows
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
            const orig = originalValuesRef.current.find(
              (o) => o.id === ev.id
            );
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
        await navigator.share({
          title: `${parent?.name ?? "Patient"} Lab Report`,
          text,
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          toast.error("Share failed");
        }
      }
    } else {
      navigator.clipboard
        .writeText(text)
        .then(() => toast.success("Copied to clipboard (Web Share not available)"))
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
      a.download = `ParentCare_${(parent?.name ?? "Report").replace(
        /\s+/g,
        "_"
      )}_${report.reportDate}.pdf`;
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
        <Button onClick={() => router.replace(`/parents/${parentId}`)}>
          Go back
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const activeEditValues = editValues.filter((v) => !v.deleted);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="flex h-14 items-center justify-between px-4">
          {editMode ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={cancelEdit}
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Cancel editing</span>
              </Button>
              <span className="font-semibold text-base flex-1 text-center">
                Edit Values
              </span>
              <div className="w-11 shrink-0" />
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
              </Button>
              <span className="font-semibold text-base truncate px-2 flex-1 text-center">
                {parent?.name ?? "Report"}
              </span>
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

                {/* Share dropdown */}
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
                    {report.originalFileBlob ? (
                      <DropdownMenuItem onClick={handleOriginalDownload}>
                        <Download className="h-4 w-4" />
                        Download original file
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-5 w-5" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </header>

      <main
        className={cn(
          "flex-1 px-4 py-6 space-y-6",
          editMode ? "pb-28" : "pb-12"
        )}
      >
        {/* ── Summary card (read mode only) ─────────────────────────────── */}
        {!editMode && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-sm font-semibold capitalize",
                    TRAFFIC_LIGHT_STYLES[report.trafficLight]
                  )}
                >
                  {report.trafficLight === "green"
                    ? "All Clear"
                    : report.trafficLight === "yellow"
                    ? "Review"
                    : "Attention"}
                </span>
              </div>
              <p className="text-base font-medium leading-snug">
                {report.headline}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{format(parseISO(report.reportDate), "d MMMM yyyy")}</span>
                {report.labName && <span>{report.labName}</span>}
                {report.testPanel && <span>{report.testPanel}</span>}
              </div>
              {report.abnormalCount > 0 && (
                <Badge variant="destructive" className="w-fit">
                  {report.abnormalCount} abnormal value
                  {report.abnormalCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Patterns (read mode only) ─────────────────────────────────── */}
        {!editMode && (
          <section>
            <h2 className="text-base font-semibold mb-3">Patterns Detected</h2>
            {report.patternsDetected.length === 0 ? (
              <p className="text-sm text-muted-foreground">No patterns flagged.</p>
            ) : (
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
            )}
          </section>
        )}

        {/* ── Values section ────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-semibold mb-3">Values</h2>

          {editMode ? (
            /* ── Edit mode: stacked edit cards ── */
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
              <Button
                variant="outline"
                className="h-11 mt-1"
                onClick={addEditValue}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add value
              </Button>
            </div>
          ) : labValues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No values recorded.</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-medium px-4 py-3">Test</th>
                      <th className="text-left font-medium px-4 py-3">Result</th>
                      <th className="text-left font-medium px-4 py-3">
                        Reference
                      </th>
                      <th className="text-left font-medium px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {labValues.map((lv) => (
                      <tr key={lv.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium">{lv.name}</p>
                            {lv.userEdited && (
                              <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                          </div>
                          {lv.explanation && (
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                              {lv.explanation}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {lv.value}
                          {lv.unit && (
                            <span className="text-muted-foreground ml-1">
                              {lv.unit}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {lv.referenceRange ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                              STATUS_BADGE[lv.status] ?? ""
                            )}
                          >
                            {lv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked cards */}
              <div className="flex sm:hidden flex-col gap-3">
                {labValues.map((lv) => (
                  <Card key={lv.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-medium truncate">{lv.name}</p>
                          {lv.userEdited && (
                            <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                            STATUS_BADGE[lv.status] ?? ""
                          )}
                        >
                          {lv.status}
                        </span>
                      </div>
                      <p className="text-sm">
                        <span className="font-medium">{lv.value}</span>
                        {lv.unit && (
                          <span className="text-muted-foreground ml-1">
                            {lv.unit}
                          </span>
                        )}
                        {lv.referenceRange && (
                          <span className="text-muted-foreground">
                            {" "}
                            · ref: {lv.referenceRange}
                          </span>
                        )}
                      </p>
                      {lv.explanation && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {lv.explanation}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── Next steps (read mode only) ───────────────────────────────── */}
        {!editMode && report.nextSteps && (
          <section>
            <h2 className="text-base font-semibold mb-3">Next Steps</h2>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm leading-relaxed text-amber-900">
                {report.nextSteps}
              </p>
            </div>
          </section>
        )}

        {/* ── Remind me button (read mode only) ────────────────────────── */}
        {!editMode && (
          <Button
            variant="outline"
            className="w-full h-11"
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

        {/* ── Parse cost (read mode only) ───────────────────────────────── */}
        {!editMode && report.parseCostInr != null && (
          <p className="text-xs text-muted-foreground">
            This parse cost ₹{report.parseCostInr.toFixed(2)}{" "}
            <span className="opacity-60">
              (
              {report.parseCostInr > 0
                ? `≈ $${(report.parseCostInr / 84).toFixed(4)}`
                : "free"}
              )
            </span>
          </p>
        )}

        {/* ── Disclaimer (read mode only) ───────────────────────────────── */}
        {!editMode && report.disclaimer && (
          <p className="text-xs text-muted-foreground/70 leading-relaxed border-t pt-4">
            {report.disclaimer}
          </p>
        )}
      </main>

      {/* ── Sticky save bar (edit mode only) ─────────────────────────────── */}
      {editMode && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t px-4 pt-3 flex gap-3"
          style={{
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={cancelEdit}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11"
            onClick={saveEdits}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      )}

      {/* ── Delete confirmation dialog ────────────────────────────────────── */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this report?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the report and all its values. This
            cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-11"
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
