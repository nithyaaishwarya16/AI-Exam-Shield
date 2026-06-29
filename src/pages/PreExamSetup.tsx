import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, Globe, Mic, Shield, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWebcam } from "@/hooks/useWebcam";
import { useAudioMonitor } from "@/hooks/useAudioMonitor";
import { useAIProctoring, type ProctoringCalibrationProfile } from "@/hooks/useAIProctoring";
import { UserExamAssistant } from "@/components/UserExamAssistant";
import { ProhibitedAppsGate } from "@/components/ProhibitedAppsGate";

export const PRE_EXAM_READY_KEY = "exam_setup_ready";
export const PRE_EXAM_CALIBRATION_KEY = "exam_calibration_profile_v1";

const EXAM_RULES = [
  "Do not switch tabs, minimize, or leave fullscreen during the exam.",
  "Only one person should be visible in front of the camera.",
  "No mobile phones, books, notes, or prohibited items are allowed.",
  "Keep your face clearly visible and remain in frame at all times.",
  "Ensure your microphone stays active for background monitoring.",
];

export default function PreExamSetup() {
  const navigate = useNavigate();
  const { videoRef, isActive: webcamActive, error: webcamError, start, stop } = useWebcam();
  const { level: audioLevel, isActive: audioActive, error: audioError } = useAudioMonitor({
    enabled: true,
    threshold: 20,
  });
  const aiDetection = useAIProctoring({
    videoRef,
    enabled: webcamActive,
    onViolation: () => {},
    intervalMs: 1500,
  });

  const [step, setStep] = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [calibrating, setCalibrating] = useState(false);
  const [calibration, setCalibration] = useState<ProctoringCalibrationProfile | null>(null);
  const [prohibitedAppsPassed, setProhibitedAppsPassed] = useState(false);

  const estimateLighting = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return 0;
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(160, video.videoWidth);
    canvas.height = Math.min(120, video.videoHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) return 0;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let total = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      total += (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    }
    const avg = total / (img.data.length / 4);
    return Math.max(0, Math.min(1, avg / 255));
  };

  const runCalibration = async () => {
    setCalibrating(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const lightingScore = estimateLighting();
    const faceCenteredScore =
      aiDetection.faceBoxes.length === 1 && videoRef.current
        ? (() => {
            const [x, y, w, h] = aiDetection.faceBoxes[0];
            const vw = videoRef.current!.videoWidth || 640;
            const vh = videoRef.current!.videoHeight || 480;
            const cx = (x + w / 2) / vw;
            const cy = (y + h / 2) / vh;
            // score 1 at center, falling toward edges
            return Math.max(0, 1 - (Math.abs(cx - 0.5) + Math.abs(cy - 0.5)));
          })()
        : 0;

    const profile: ProctoringCalibrationProfile = {
      lightingScore,
      micBaseline: audioLevel,
      faceCenteredScore,
    };
    setCalibration(profile);
    localStorage.setItem(PRE_EXAM_CALIBRATION_KEY, JSON.stringify(profile));
    setCalibrating(false);
  };

  useEffect(() => {
    localStorage.removeItem(PRE_EXAM_READY_KEY);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (step >= 2) {
      start();
    } else {
      stop();
    }
    return () => {
      stop();
    };
  }, [step, start, stop]);

  const systemChecks = useMemo(
    () => [
      { label: "Internet connectivity", ok: isOnline, detail: isOnline ? "Connected" : "Offline" },
      { label: "Webcam access", ok: webcamActive, detail: webcamActive ? "Camera ready" : webcamError || "Waiting for camera permission" },
      { label: "Microphone access", ok: audioActive, detail: audioActive ? `Mic ready (${audioLevel.toFixed(0)}% level)` : audioError || "Waiting for microphone permission" },
    ],
    [isOnline, webcamActive, webcamError, audioActive, audioError, audioLevel]
  );

  const allChecksPassed = systemChecks.every((item) => item.ok);
  const calibrationPassed =
    !!calibration &&
    (calibration.lightingScore ?? 0) >= 0.22 &&
    (calibration.faceCenteredScore ?? 0) >= 0.45 &&
    audioActive;

  const startExam = () => {
    localStorage.setItem(PRE_EXAM_READY_KEY, "true");
    navigate("/exam");
  };

  return (
    <div className="min-h-screen gradient-hero p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <header className="gradient-card rounded-2xl p-5 flex items-center justify-between gap-4 border-border/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/40 border border-border/50">
              <Shield className="w-4 h-4 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <span className="font-heading font-semibold text-foreground tracking-tight block">Before you begin</span>
              <span className="text-xs text-muted-foreground">A few checks so the session runs smoothly</span>
            </div>
          </div>
          <div className="text-sm text-muted-foreground tabular-nums shrink-0">Step {step} of 5</div>
        </header>

        {step === 1 && (
          <Card className="gradient-card">
            <CardHeader>
              <CardTitle>Page 1: Exam Rules & Terms</CardTitle>
              <CardDescription>Read and accept the rules before continuing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                {EXAM_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                />
                I have read and accept the exam rules and terms.
              </label>
              <div className="flex justify-end">
                <Button disabled={!acceptedTerms} onClick={() => setStep(2)}>
                  Continue to System Checks
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="gradient-card">
            <CardHeader>
              <CardTitle>Page 2: System Checks</CardTitle>
              <CardDescription>Internet, webcam, and microphone must be ready.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 font-medium"><Globe className="w-4 h-4" /> Internet</div>
                  <p className="text-sm text-muted-foreground mt-1">{systemChecks[0].detail}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 font-medium"><Camera className="w-4 h-4" /> Webcam</div>
                  <p className="text-sm text-muted-foreground mt-1">{systemChecks[1].detail}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 font-medium"><Mic className="w-4 h-4" /> Microphone</div>
                  <p className="text-sm text-muted-foreground mt-1">{systemChecks[2].detail}</p>
                </div>
              </div>

              <div className="space-y-2">
                {systemChecks.map((item) => (
                  <div key={item.label} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <span className="text-sm">{item.label}</span>
                    <span className="flex items-center gap-1 text-sm">
                      {item.ok ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Pass
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          Fail
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg overflow-hidden border bg-black/70 aspect-video max-w-md">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              </div>

              <UserExamAssistant
                context="setup"
                webcamActive={webcamActive}
                audioActive={audioActive}
                isOnline={isOnline}
                webcamError={webcamError}
                audioError={audioError}
              />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button disabled={!allChecksPassed} onClick={() => setStep(3)}>
                  Continue to Calibration
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="gradient-card">
            <CardHeader>
              <CardTitle>Page 3: Calibration</CardTitle>
              <CardDescription>Calibrate camera angle, lighting, and mic baseline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg overflow-hidden border bg-black/70 aspect-video max-w-md">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Lighting score: <span className="font-medium text-foreground">{calibration?.lightingScore?.toFixed(2) ?? "-"}</span> (min 0.22)</p>
                <p>Face centered score: <span className="font-medium text-foreground">{calibration?.faceCenteredScore?.toFixed(2) ?? "-"}</span> (min 0.45)</p>
                <p>Mic baseline: <span className="font-medium text-foreground">{calibration?.micBaseline?.toFixed(1) ?? "-"}</span></p>
              </div>
              <div className="flex gap-2">
                <Button onClick={runCalibration} disabled={calibrating || !webcamActive || !audioActive}>
                  {calibrating ? "Calibrating..." : "Run Calibration"}
                </Button>
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button disabled={!calibrationPassed} onClick={() => setStep(4)}>
                  Continue to app check
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="gradient-card">
            <CardHeader>
              <CardTitle>Page 4: Close messaging & remote tools</CardTitle>
              <CardDescription>
                The exam cannot start until common cheating tools (Teams, Zoom, Discord, etc.) are not running.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProhibitedAppsGate onPassedChange={setProhibitedAppsPassed} />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button disabled={!prohibitedAppsPassed} onClick={() => setStep(5)}>
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card className="gradient-card">
            <CardHeader>
              <CardTitle>Final Step: Start Exam</CardTitle>
              <CardDescription>All setup steps are complete.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Rules accepted: <span className="text-foreground font-medium">Yes</span></p>
                <p>System checks: <span className="text-foreground font-medium">Passed</span></p>
                <p>Calibration: <span className="text-foreground font-medium">{calibrationPassed ? "Passed" : "Not completed"}</span></p>
                <p>
                  Prohibited apps:{" "}
                  <span className="text-foreground font-medium">{prohibitedAppsPassed ? "Clear" : "Not completed"}</span>
                </p>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(4)}>
                  Back
                </Button>
                <Button onClick={startExam}>
                  Start Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
