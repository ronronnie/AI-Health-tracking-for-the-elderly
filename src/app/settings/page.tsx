"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";

const BACKEND_URL = "http://localhost:8000";

type HealthStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; corpusChunks: number }
  | { state: "error"; message: string };

export default function SettingsPage() {
  const router = useRouter();
  const [confirmClear, setConfirmClear] = useState(false);
  const [health, setHealth] = useState<HealthStatus>({ state: "idle" });

  async function testConnection() {
    setHealth({ state: "checking" });
    try {
      const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        setHealth({ state: "error", message: `HTTP ${res.status}` });
        return;
      }
      const body = await res.json();
      setHealth({ state: "ok", corpusChunks: body.corpus_chunks ?? 0 });
    } catch (e) {
      setHealth({
        state: "error",
        message: e instanceof Error ? e.message : "Unreachable",
      });
    }
  }

  async function handleExport() {
    try {
      const [parents, reports, labValues, reminders] = await Promise.all([
        db.parents.toArray(),
        db.reports.toArray(),
        db.labValues.toArray(),
        db.reminders.toArray(),
      ]);

      const reportsClean = reports.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ originalFileBlob: _blob, ...rest }) => rest
      );

      const payload = {
        exportedAt: new Date().toISOString(),
        parents,
        reports: reportsClean,
        labValues,
        reminders,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `parentcare-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported!");
    } catch {
      toast.error("Export failed.");
    }
  }

  async function handleClearData() {
    try {
      await Promise.all([
        db.parents.clear(),
        db.reports.clear(),
        db.labValues.clear(),
        db.reminders.clear(),
      ]);
      localStorage.removeItem("parentcare_onboarded");
      toast.success("All data cleared");
      router.replace("/onboarding");
    } catch {
      toast.error("Failed to clear data.");
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex h-14 items-center gap-1 px-3">
          <Button
            variant="ghost"
            className="gap-1 px-2 h-11 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </Button>
          <h1 className="font-semibold text-lg ml-1">Settings</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-28 space-y-5">
        {/* Data */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Data
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <Button
              variant="outline"
              className="w-full h-11 justify-start font-normal rounded-xl"
              onClick={handleExport}
            >
              Export all data as JSON
            </Button>

            <Separator />

            {!confirmClear ? (
              <Button
                variant="destructive"
                className="w-full h-11 justify-start font-normal rounded-xl"
                onClick={() => setConfirmClear(true)}
              >
                Clear all data
              </Button>
            ) : (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-muted-foreground">
                  This deletes all parents, reports, reminders, and resets
                  onboarding. Are you sure?
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl"
                    onClick={() => setConfirmClear(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 h-11 rounded-xl"
                    onClick={handleClearData}
                  >
                    Clear everything
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backend */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Backend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              Backend API:{" "}
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {BACKEND_URL}
              </code>
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={testConnection}
                disabled={health.state === "checking"}
              >
                {health.state === "checking" ? "Checking…" : "Test connection"}
              </Button>

              {health.state === "ok" && (
                <Badge className="status-normal border text-xs px-3 py-1">
                  Connected · {health.corpusChunks} chunks
                </Badge>
              )}

              {health.state === "error" && (
                <Badge className="status-critical border text-xs px-3 py-1">
                  {health.message}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* API Key */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              API Key Status
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Configured server-side. If you&apos;re the operator, set{" "}
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                ANTHROPIC_API_KEY
              </code>{" "}
              in Vercel.
            </p>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2 px-5 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              About
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              ParentCare v0.1.0 — A personal health tracker for your parents.
              Built with Next.js, Dexie, and the Anthropic API.
            </p>
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              Anthropic Console →
            </a>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
