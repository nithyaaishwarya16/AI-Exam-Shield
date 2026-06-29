import {
  AlertTriangle, Copy, MousePointer, Monitor, Terminal, Clipboard,
  UserX, Users, Smartphone, Eye, EyeOff, Volume2, Maximize,
} from "lucide-react";
import type { Violation, ViolationType } from "@/hooks/useBrowserMonitoring";

const iconMap: Record<ViolationType, React.ElementType> = {
  "tab-switch": Monitor,
  copy: Copy,
  paste: Clipboard,
  "right-click": MousePointer,
  "dev-tools": Terminal,
  minimize: Monitor,
  "no-face": UserX,
  "multiple-faces": Users,
  "prohibited-object": Smartphone,
  "gaze-away": Eye,
  "face-obscured": EyeOff,
  "loud-noise": Volume2,
  "fullscreen-exit": Maximize,
  "identity-mismatch": UserX,
  "identity-enrollment-failed": UserX,
};

interface ViolationLogProps {
  violations: Violation[];
}

function typeLabel(type: string): string {
  if (type === "prohibited-object") return "Mobile phone";
  return type
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function ViolationLog({ violations }: ViolationLogProps) {
  const violationsByType = violations.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1;
    return acc;
  }, {} as Record<ViolationType, number>);

  const typeEntries = Object.entries(violationsByType);

  return (
    <div className="gradient-card rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <span className="text-sm font-medium text-foreground">Violation Log</span>
        <span className="ml-auto text-xs font-mono text-destructive">
          {violations.length} {violations.length === 1 ? "event" : "events"}
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {violations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No violations detected
          </div>
        ) : (
          <>
            {/* Summary by type with icons + counts */}
            <div className="px-4 py-3 border-b border-border bg-muted/10 flex flex-wrap gap-3">
              {typeEntries.map(([type, count]) => {
                const Icon = iconMap[type as ViolationType] || AlertTriangle;
                const label = typeLabel(type);

                return (
                  <div
                    key={type}
                    className="flex items-center gap-2 px-2 py-1 rounded-full bg-background/60 border border-border"
                  >
                    <Icon className="w-3 h-3 text-destructive" />
                    <span className="text-xs font-medium">{label}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Detailed list below */}
            <div className="divide-y divide-border">
              {violations.map((v) => {
                const Icon = iconMap[v.type] || AlertTriangle;
                return (
                  <div
                    key={v.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{v.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
