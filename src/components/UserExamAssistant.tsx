import { useEffect, useMemo, useState } from "react";
import { Bot, Volume2, Accessibility, AlertCircle, Minimize2 } from "lucide-react";
import type { AIDetection } from "@/hooks/useAIProctoring";
import type { Violation } from "@/hooks/useBrowserMonitoring";
import { Button } from "@/components/ui/button";

type AssistantContext = "setup" | "exam";

interface UserExamAssistantProps {
  context: AssistantContext;
  webcamActive: boolean;
  audioActive: boolean;
  isOnline?: boolean;
  webcamError?: string | null;
  audioError?: string | null;
  detection?: AIDetection;
  latestViolation?: Violation | null;
  onLargeTextChange?: (enabled: boolean) => void;
  onHighContrastChange?: (enabled: boolean) => void;
  compactByDefault?: boolean;
  floating?: boolean;
}

function explainViolation(type: string): string {
  const map: Record<string, string> = {
    "multiple-faces": "Only one person is allowed in camera frame. Ask others to move away and keep only your face visible.",
    "no-face": "Your face is not visible. Move into frame and keep your face centered.",
    "face-obscured": "Your face is not clear. Improve lighting and remove anything blocking your face.",
    "gaze-away": "You looked away from the screen for too long. Keep your eyes and head toward the screen.",
    "identity-mismatch": "The current face did not match enrolled identity. Ensure the same candidate remains in front of camera.",
    "loud-noise": "Loud sound was detected. Move to a quieter place and reduce background noise.",
    "tab-switch": "Switching tabs is not allowed during exam. Stay on exam tab.",
    minimize: "Window focus was lost. Keep exam window active and visible.",
    "fullscreen-exit": "Fullscreen was exited. Re-enter fullscreen and continue exam.",
  };
  return map[type] || "Please follow exam rules and keep camera/audio/browser stable.";
}

export function UserExamAssistant({
  context,
  webcamActive,
  audioActive,
  isOnline = true,
  webcamError,
  audioError,
  detection,
  latestViolation,
  onLargeTextChange,
  onHighContrastChange,
  compactByDefault = false,
  floating = false,
}: UserExamAssistantProps) {
  const [isOpen, setIsOpen] = useState(!compactByDefault);
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [voiceHints, setVoiceHints] = useState(false);

  const readinessTips = useMemo(() => {
    const tips: string[] = [];
    if (!isOnline) tips.push("Internet is offline. Reconnect before continuing.");
    if (!webcamActive) tips.push(webcamError || "Allow webcam permission in browser settings.");
    if (!audioActive) tips.push(audioError || "Allow microphone permission and choose correct mic.");
    if (tips.length === 0) tips.push("Great! System looks ready.");
    return tips;
  }, [isOnline, webcamActive, audioActive, webcamError, audioError]);

  const compliancePrompt = useMemo(() => {
    if (!detection) return "Monitoring will guide you during exam.";
    if (!detection.faceVisible) return "Please move into frame so your face is visible.";
    if (detection.faces > 1) return "Only one person should be in frame.";
    if (detection.gazeAway) return "Please face the screen and keep your head centered.";
    if (detection.faceObscured) return "Please improve lighting and keep your face clear.";
    if (detection.prohibitedObjects.length > 0) return "Remove prohibited objects from the desk area.";
    return "Good posture and focus maintained.";
  }, [detection]);

  const latestViolationHelp = latestViolation
    ? explainViolation(latestViolation.type)
    : "No recent violation. Keep this panel open for guidance.";

  useEffect(() => {
    onLargeTextChange?.(largeText);
  }, [largeText, onLargeTextChange]);

  useEffect(() => {
    onHighContrastChange?.(highContrast);
  }, [highContrast, onHighContrastChange]);

  useEffect(() => {
    if (!voiceHints) return;
    const text =
      context === "setup"
        ? readinessTips[0]
        : latestViolation
          ? `Alert: ${latestViolation.type}. ${latestViolationHelp}`
          : compliancePrompt;
    if (!text || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, [voiceHints, context, readinessTips, compliancePrompt, latestViolation, latestViolationHelp]);

  if (!isOpen && compactByDefault) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`rounded-full w-12 h-12 flex items-center justify-center shadow-lg border border-primary/30 bg-primary text-primary-foreground hover:opacity-90 transition-opacity ${
          floating ? "fixed bottom-5 right-5 z-50" : ""
        }`}
        aria-label="Open AI Student Assistant"
        title="Open AI Student Assistant"
      >
        <Bot className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div
      className={`gradient-card rounded-lg p-4 space-y-4 ${
        floating ? "fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-24px)] shadow-2xl" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold flex-1">AI Student Assistant</span>
        {compactByDefault && (
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setIsOpen(false)}>
            <Minimize2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          {context === "setup" ? "Pre-exam readiness coach" : "Live compliance coach"}
        </div>
        {context === "setup" ? (
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
            {readinessTips.map((tip, idx) => (
              <li key={`${tip}-${idx}`}>{tip}</li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-primary" />
            <span>{compliancePrompt}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Explain latest warning</div>
        <div className="text-xs bg-muted/40 border rounded p-2">
          {latestViolation ? (
            <>
              <div className="font-medium mb-1">{latestViolation.type}</div>
              <div className="text-muted-foreground">{latestViolationHelp}</div>
            </>
          ) : (
            <div className="text-muted-foreground">No recent warning to explain.</div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Accessibility className="w-3.5 h-3.5" />
          Accessibility assistant
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={largeText ? "default" : "outline"} onClick={() => setLargeText((v) => !v)}>
            Larger text
          </Button>
          <Button size="sm" variant={highContrast ? "default" : "outline"} onClick={() => setHighContrast((v) => !v)}>
            High contrast
          </Button>
          <Button size="sm" variant={voiceHints ? "default" : "outline"} onClick={() => setVoiceHints((v) => !v)}>
            <Volume2 className="w-3.5 h-3.5 mr-1" />
            Voice hints
          </Button>
        </div>
      </div>
    </div>
  );
}

