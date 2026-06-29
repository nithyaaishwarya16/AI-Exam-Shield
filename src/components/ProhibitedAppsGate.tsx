import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PROHIBITED_APPS } from "@/config/prohibitedApps";
import type { ProcessScanResult } from "@/types/examShield";

function isDesktopShell(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.examShield?.isDesktopShell &&
    typeof window.examShield.checkProhibitedProcesses === "function"
  );
}

type ProhibitedAppsGateProps = {
  onPassedChange: (passed: boolean) => void;
};

export function ProhibitedAppsGate({ onPassedChange }: ProhibitedAppsGateProps) {
  const desktop = isDesktopShell();
  const [scanning, setScanning] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessScanResult[] | null>(null);
  /** Browser-only: user confirms each app is closed; cleared on "Check again". */
  const [manualAck, setManualAck] = useState<Record<string, boolean>>({});

  const runningFromScan = results?.filter((r) => r.running) ?? [];

  const runScan = useCallback(async () => {
    setLastError(null);
    if (desktop) {
      setScanning(true);
      setResults(null);
      try {
        const raw = await window.examShield!.checkProhibitedProcesses!();
        setResults(raw);
      } catch (e) {
        setResults(null);
        setLastError(e instanceof Error ? e.message : "Process scan failed.");
      } finally {
        setScanning(false);
      }
    } else {
      setManualAck({});
      setResults(null);
    }
    onPassedChange(false);
  }, [desktop, onPassedChange]);

  const toggleManual = (id: string) => {
    setManualAck((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const ok = desktop
      ? results !== null && runningFromScan.length === 0 && !lastError && !scanning
      : PROHIBITED_APPS.every((a) => manualAck[a.id]);
    onPassedChange(ok && (desktop ? results !== null : true));
  }, [
    desktop,
    results,
    runningFromScan.length,
    lastError,
    scanning,
    manualAck,
    onPassedChange,
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2 text-sm">
        <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
        <div className="space-y-1">
          {desktop ? (
            <p>
              The desktop shell scans running programs (similar to Task Manager). Close every app listed as
              running, then run the scan again until all are clear.
            </p>
          ) : (
            <p>
              A normal website cannot read Task Manager. Install and run{" "}
              <span className="font-medium text-foreground">Exam Shield Desktop</span> (
              <code className="text-xs">npm run electron:dev</code>) for automatic detection. In the browser,
              confirm manually that each program is fully closed—not minimized.
            </p>
          )}
        </div>
      </div>

      {lastError && (
        <div className="text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {lastError}
        </div>
      )}

      {desktop && results && runningFromScan.length > 0 && (
        <div className="text-sm flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Still running — end these tasks, then scan again:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-foreground">
              {runningFromScan.map((r) => (
                <li key={r.id}>
                  {r.displayName}
                  {r.matchedExecutable ? (
                    <span className="text-muted-foreground"> ({r.matchedExecutable})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {desktop && results && runningFromScan.length === 0 && !lastError && (
        <div className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> No prohibited apps detected. You can continue.
        </div>
      )}

      <div className="space-y-2">
        {PROHIBITED_APPS.map((app) => {
          const scan = results?.find((r) => r.id === app.id);
          return (
            <div
              key={app.id}
              className="flex flex-wrap items-center justify-between gap-2 border rounded-md px-3 py-2"
            >
              <span className="text-sm">{app.displayName}</span>
              {desktop ? (
                <span className="flex items-center gap-1 text-sm shrink-0">
                  {!results ? (
                    <span className="text-muted-foreground">Not scanned yet</span>
                  ) : scan?.running ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-500" /> Running
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Clear
                    </>
                  )}
                </span>
              ) : (
                <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
                  <input type="checkbox" checked={!!manualAck[app.id]} onChange={() => toggleManual(app.id)} />
                  I closed this completely
                </label>
              )}
            </div>
          );
        })}
      </div>

      <Button type="button" variant="secondary" onClick={runScan} disabled={scanning} className="gap-2">
        {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {desktop ? (scanning ? "Scanning…" : "Scan for prohibited apps") : "Check again (clears confirmations)"}
      </Button>
    </div>
  );
}
