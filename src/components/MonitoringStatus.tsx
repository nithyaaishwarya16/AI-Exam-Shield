import { Shield, Camera, Mic, Globe, ShieldAlert, Brain } from "lucide-react";

interface StatusItem {
  label: string;
  active: boolean;
  icon: React.ElementType;
}

interface MonitoringStatusProps {
  webcamActive: boolean;
  audioActive: boolean;
  browserMonitoring: boolean;
  violationCount: number;
  /** Object detection: phone / prohibited items (same as `prohibited-object` violations). */
  mobilePhoneViolationCount?: number;
  aiModelLoaded?: boolean;
}

export function MonitoringStatus({
  webcamActive,
  audioActive,
  browserMonitoring,
  violationCount,
  mobilePhoneViolationCount = 0,
  aiModelLoaded,
}: MonitoringStatusProps) {
  const items: StatusItem[] = [
    { label: "Webcam", active: webcamActive, icon: Camera },
    { label: "Audio", active: audioActive, icon: Mic },
    { label: "Browser Guard", active: browserMonitoring, icon: Globe },
    { label: "AI Detection", active: aiModelLoaded ?? false, icon: Brain },
  ];

  const allActive = items.every((i) => i.active);

  return (
    <div
      className={`gradient-card rounded-2xl p-4 transition-shadow ${
        allActive ? "ring-1 ring-primary/25 shadow-sm" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {allActive ? (
          <Shield className="w-4 h-4 text-primary" strokeWidth={1.75} />
        ) : (
          <ShieldAlert className="w-4 h-4 text-warning" strokeWidth={1.75} />
        )}
        <span className="text-sm font-medium text-foreground">Session status</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <item.icon className={`w-3.5 h-3.5 ${item.active ? "text-success" : "text-muted-foreground"}`} />
            <span className="text-sm text-secondary-foreground flex-1">{item.label}</span>
            <span className={`text-xs font-medium ${item.active ? "text-success" : "text-muted-foreground"}`}>
              {item.active ? "Active" : item.label === "AI Detection" ? "Loading…" : "Inactive"}
            </span>
          </div>
        ))}
      </div>
      {violationCount > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Violations</span>
            <span className="text-xs font-bold text-destructive">{violationCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Mobile phone</span>
            <span
              className={`text-xs font-bold ${
                mobilePhoneViolationCount > 0 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {mobilePhoneViolationCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
