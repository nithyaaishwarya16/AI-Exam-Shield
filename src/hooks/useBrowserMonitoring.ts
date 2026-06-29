import { useEffect, useCallback, useRef } from "react";

export type ViolationType =
  | "tab-switch"
  | "copy"
  | "paste"
  | "right-click"
  | "dev-tools"
  | "minimize"
  | "no-face"
  | "multiple-faces"
  | "prohibited-object"
  | "gaze-away"
  | "face-obscured"
  | "loud-noise"
  | "fullscreen-exit"
  | "identity-mismatch"
  | "identity-enrollment-failed";

export interface Violation {
  id: string;
  type: ViolationType;
  message: string;
  timestamp: Date;
}

interface UseBrowserMonitoringProps {
  enabled: boolean;
  onViolation: (violation: Omit<Violation, "id">) => void;
}

export function useBrowserMonitoring({ enabled, onViolation }: UseBrowserMonitoringProps) {
  const violationRef = useRef(onViolation);
  violationRef.current = onViolation;

  const report = useCallback((type: Violation["type"], message: string) => {
    violationRef.current({ type, message, timestamp: new Date() });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) {
        report("tab-switch", "Tab switch or window minimized detected");
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      report("copy", "Copy attempt blocked");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      report("paste", "Paste attempt blocked");
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      report("right-click", "Right-click attempt blocked");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+Shift+I, F12
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        report("copy", "Keyboard copy attempt blocked");
      }
      if (e.ctrlKey && e.key === "v") {
        e.preventDefault();
        report("paste", "Keyboard paste attempt blocked");
      }
      if ((e.ctrlKey && e.shiftKey && e.key === "I") || e.key === "F12") {
        e.preventDefault();
        report("dev-tools", "Developer tools shortcut blocked");
      }
    };

    const handleBlur = () => {
      report("minimize", "Window lost focus");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        report("fullscreen-exit", "Fullscreen mode exited — exam requires fullscreen");
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Block print screen
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        navigator.clipboard.writeText("").catch(() => {});
        report("copy", "Screenshot attempt blocked");
      }
    };
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, report]);
}
