import { useState, useEffect, useCallback } from "react";
import { Clock } from "lucide-react";

interface ExamTimerProps {
  durationMinutes: number;
  running: boolean;
  onTimeUp: () => void;
}

export function ExamTimer({ durationMinutes, running, onTimeUp }: ExamTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, onTimeUp]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const pct = (secondsLeft / (durationMinutes * 60)) * 100;
  const isLow = pct < 20;

  return (
    <div className={`gradient-card rounded-lg p-4 ${isLow ? "glow-red" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <Clock className={`w-4 h-4 ${isLow ? "text-destructive" : "text-primary"}`} />
        <span className="text-sm font-medium text-foreground">Time Remaining</span>
      </div>
      <div className={`text-3xl font-mono font-bold tabular-nums ${isLow ? "text-destructive" : "text-foreground"}`}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isLow ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
