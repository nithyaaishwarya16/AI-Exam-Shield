import { Mic, MicOff } from "lucide-react";

interface AudioLevelMeterProps {
  level: number;
  isActive: boolean;
  error: string | null;
}

export function AudioLevelMeter({ level, isActive, error }: AudioLevelMeterProps) {
  const getBarColor = (i: number, total: number) => {
    const pct = (i / total) * 100;
    if (pct > 75) return "bg-destructive";
    if (pct > 50) return "bg-warning";
    return "bg-primary";
  };

  const bars = 20;
  const filledBars = Math.round((level / 100) * bars);

  return (
    <div className="gradient-card rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {isActive ? (
          <Mic className="w-4 h-4 text-primary" />
        ) : (
          <MicOff className="w-4 h-4 text-destructive" />
        )}
        <span className="text-sm font-medium text-foreground">Audio Monitor</span>
        <span className={`ml-auto w-2 h-2 rounded-full ${isActive ? "bg-success pulse-dot" : "bg-destructive"}`} />
      </div>
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        <>
          <div className="flex items-end gap-0.5 h-8 mb-2">
            {Array.from({ length: bars }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all duration-75 ${
                  i < filledBars ? getBarColor(i, bars) : "bg-muted"
                }`}
                style={{ height: `${((i + 1) / bars) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Level: {Math.round(level)}%</span>
            <span>{level >= 50 ? "⚠ Loud (Violation)" : level >= 30 ? "Moderate" : "Normal"}</span>
          </div>
        </>
      )}
    </div>
  );
}
