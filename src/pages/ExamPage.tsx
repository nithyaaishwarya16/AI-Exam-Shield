import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";

import { WebcamMonitor } from "@/components/WebcamMonitor";
import { AudioLevelMeter } from "@/components/AudioLevelMeter";
import { ViolationLog } from "@/components/ViolationLog";
import { ExamTimer } from "@/components/ExamTimer";
import { MonitoringStatus } from "@/components/MonitoringStatus";
import { ExamQuestions } from "@/components/ExamQuestions";
import { Button } from "@/components/ui/button";
import { UserExamAssistant } from "@/components/UserExamAssistant";

import {
  useBrowserMonitoring,
  type Violation,
} from "@/hooks/useBrowserMonitoring";
import { useAudioMonitor } from "@/hooks/useAudioMonitor";
import { useWebcam } from "@/hooks/useWebcam";
import { useAIProctoring } from "@/hooks/useAIProctoring";
import { useScreenshotCapture } from "@/hooks/useScreenshotCapture";
import { useVideoRecording } from "@/hooks/useVideoRecording";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import type { AIDetection, ProctoringCalibrationProfile } from "@/hooks/useAIProctoring";
import { PRE_EXAM_READY_KEY, PRE_EXAM_CALIBRATION_KEY } from "@/pages/PreExamSetup";

const IDENTITY_ENROLLMENT_SAMPLES = 3;
const IDENTITY_DESCRIPTOR_SIZE = 48; // finer crop = more discriminative between people
const IDENTITY_SIMILARITY_THRESHOLD = 0.88; // stricter; 0.92 was too lenient vs different faces
const IDENTITY_PIXEL_WEIGHT = 0.55;
const IDENTITY_LANDMARK_WEIGHT = 0.45;
const IDENTITY_MISMATCH_CONSECUTIVE_LIMIT = 2;
const FACE_RELATED_VIOLATION_TYPES: Violation["type"][] = [
  "multiple-faces",
  "no-face",
  "face-obscured",
  "gaze-away",
  "identity-mismatch",
];

type FaceLandmarks = [number, number][];

/** Creates a discriminative descriptor from face landmarks (rightEye, leftEye, nose, mouth, rightEar, leftEar).
 * Geometry differs significantly between different people. */
function computeLandmarkDescriptor(
  landmarks: FaceLandmarks,
  faceBox: [number, number, number, number]
): Float32Array {
  const [fx, fy, fw, fh] = faceBox;
  if (fw <= 0 || fh <= 0) return new Float32Array(0);

  const vec: number[] = [];

  // Normalize landmarks relative to face box (scale-invariant)
  for (const [lx, ly] of landmarks) {
    vec.push((lx - fx) / fw);
    vec.push((ly - fy) / fh);
  }

  // Geometric ratios unique to each face
  const [rightEye, leftEye, nose, mouth] = landmarks;
  const eyeDist = Math.hypot(rightEye[0] - leftEye[0], rightEye[1] - leftEye[1]);
  const eyeMidX = (rightEye[0] + leftEye[0]) / 2;
  const eyeMidY = (rightEye[1] + leftEye[1]) / 2;
  vec.push(eyeDist / fw);
  vec.push(eyeDist / fh);
  vec.push((nose[0] - eyeMidX) / fw);
  vec.push((nose[1] - eyeMidY) / fh);
  vec.push((mouth[0] - eyeMidX) / fw);
  vec.push((mouth[1] - eyeMidY) / fh);
  vec.push(Math.hypot(nose[0] - mouth[0], nose[1] - mouth[1]) / fh);

  if (landmarks.length >= 6) {
    const [rightEar, leftEar] = landmarks.slice(4, 6);
    vec.push((rightEar[0] - rightEye[0]) / fw);
    vec.push((leftEye[0] - leftEar[0]) / fw);
  }

  const out = new Float32Array(vec);
  let norm = 0;
  for (let i = 0; i < out.length; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

function computePixelDescriptor(
  video: HTMLVideoElement,
  faceBox: [number, number, number, number]
): Float32Array | null {
  const [x, y, width, height] = faceBox;
  if (width <= 0 || height <= 0) return null;

  const canvas = document.createElement("canvas");
  const size = IDENTITY_DESCRIPTOR_SIZE;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    ctx.drawImage(video, x, y, width, height, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    const vec = new Float32Array(size * size);

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      vec[j] = gray;
    }

    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return vec;
  } catch (err) {
    console.error("Failed to compute face descriptor:", err);
    return null;
  }
}

function combineDescriptors(
  pixel: Float32Array,
  landmark: Float32Array | null
): Float32Array {
  if (!landmark || landmark.length === 0) return pixel;

  const out = new Float32Array(pixel.length + landmark.length);
  for (let i = 0; i < pixel.length; i++) {
    out[i] = pixel[i] * IDENTITY_PIXEL_WEIGHT;
  }
  for (let i = 0; i < landmark.length; i++) {
    out[pixel.length + i] = landmark[i] * IDENTITY_LANDMARK_WEIGHT;
  }

  // Normalize combined vector so cosine similarity is stable.
  let norm = 0;
  for (let i = 0; i < out.length; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= norm;

  return out;
}

function maxCosineSimilarity(
  current: Float32Array,
  baselines: Float32Array[]
): number {
  if (!baselines.length) return 0;
  let best = -1;
  for (const base of baselines) {
    let dot = 0;
    const len = Math.min(base.length, current.length);
    for (let i = 0; i < len; i++) {
      dot += base[i] * current[i];
    }
    if (dot > best) best = dot;
  }
  return best;
}

function meanDescriptor(vectors: Float32Array[]): Float32Array | null {
  if (!vectors.length) return null;
  const len = vectors[0].length;
  const out = new Float32Array(len);

  for (const vec of vectors) {
    if (vec.length !== len) return null;
    for (let i = 0; i < len; i++) {
      out[i] += vec[i];
    }
  }

  for (let i = 0; i < len; i++) {
    out[i] /= vectors.length;
  }

  // Normalize centroid so it stays compatible with cosine similarity.
  let norm = 0;
  for (let i = 0; i < len; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < len; i++) out[i] /= norm;

  return out;
}

function robustIdentitySimilarity(
  current: Float32Array,
  baselines: Float32Array[]
): number {
  if (!baselines.length) return 0;
  const bestSample = maxCosineSimilarity(current, baselines);
  const centroid = meanDescriptor(baselines);
  if (!centroid) return bestSample;

  const centroidSimilarity = maxCosineSimilarity(current, [centroid]);
  // Require agreement with both the nearest enrollment frame and the centroid.
  // A weighted blend was too forgiving when a different person still matched one of the two.
  return Math.min(bestSample, centroidSimilarity);
}

export default function ExamPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { captureFromVideo } = useScreenshotCapture();

  const [violations, setViolations] = useState<Violation[]>([]);
  const [examFinished, setExamFinished] = useState(false);
  const [examSessionId, setExamSessionId] = useState<string | null>(null);
  const [identityStatus, setIdentityStatus] = useState<
    "enrolling" | "verified" | "blocked"
  >("enrolling");
  const [identitySamples, setIdentitySamples] = useState(0);
  const [lastIdentitySimilarity, setLastIdentitySimilarity] = useState<number | null>(null);
  const [autoSubmitReason, setAutoSubmitReason] = useState<string | null>(null);
  const [largeTextMode, setLargeTextMode] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [calibrationProfile, setCalibrationProfile] = useState<ProctoringCalibrationProfile | null>(null);

  const identityDescriptorsRef = useRef<Float32Array[]>([]);
  const identityBlockedRef = useRef(false);
  const identityMismatchStreakRef = useRef(0);

  useEffect(() => {
    const ready = localStorage.getItem(PRE_EXAM_READY_KEY) === "true";
    if (!ready) {
      navigate("/exam/setup", { replace: true });
      return;
    }
    // One-time token, must run setup each time before starting exam.
    localStorage.removeItem(PRE_EXAM_READY_KEY);
  }, [navigate]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRE_EXAM_CALIBRATION_KEY);
      if (raw) {
        setCalibrationProfile(JSON.parse(raw));
      }
    } catch (error) {
      console.error("Failed to load calibration profile:", error);
    }
  }, []);

  // Redirect admins away from exam page
  useEffect(() => {
    if (user?.role === "admin") {
      navigate("/admin", { replace: true });
    }
  }, [user, navigate]);

  // If admin somehow renders this page, show a friendly message
  if (user?.role === "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <div className="gradient-card rounded-xl p-8 max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Admin Access
          </h2>
          <p className="text-muted-foreground mb-6">
            Admins cannot take exams. Redirecting to Admin Dashboard...
          </p>
          <Button onClick={() => navigate("/admin")}>
            Go to Admin Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Webcam is owned at page level so AI proctoring & screenshots can access the video ref
  const {
    videoRef,
    isActive: webcamActive,
    error: webcamError,
    start: startWebcam,
    stop: stopWebcam,
  } = useWebcam();

  // Video recording of the session
  const { isRecording, recordingTime, getRecordingBlob } = useVideoRecording({
    videoRef,
    enabled: !examFinished && webcamActive,
  });

  // Start / stop webcam with exam lifecycle
  useEffect(() => {
    if (!examFinished) {
      startWebcam();
    } else {
      stopWebcam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examFinished]);

  // Request fullscreen while exam is running
  useEffect(() => {
    if (!examFinished && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, [examFinished]);

  // Create session once per exam attempt so violations are linked and visible in admin sessions.
  useEffect(() => {
    if (examFinished || examSessionId) return;
    let cancelled = false;

    const createSession = async () => {
      try {
        const activeExamsRes = await apiClient.getActiveExams();
        const activeExams = Array.isArray(activeExamsRes.data) ? activeExamsRes.data : [];
        const firstExamId = activeExams[0]?._id;
        const startRes = await apiClient.startExamSession(firstExamId || "");
        const sessionId = startRes.data?._id;
        if (!cancelled && sessionId) {
          setExamSessionId(sessionId);
        }
      } catch (error) {
        console.error("Failed to start exam session:", error);
      }
    };

    createSession();
    return () => {
      cancelled = true;
    };
  }, [examFinished, examSessionId]);

  const addViolation = useCallback(
    async (violation: Omit<Violation, "id">) => {
      const v: Violation = {
        ...violation,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      setViolations((prev) => [...prev, v]);

       // Auto-submit exam on critical violations like tab switch or window focus loss
       if (
         violation.type === "tab-switch" ||
         violation.type === "minimize" ||
         violation.type === "fullscreen-exit" ||
         violation.type === "multiple-faces"
       ) {
         setAutoSubmitReason((prev) => prev ?? violation.message);
       }

      try {
        const shouldCaptureScreenshot = FACE_RELATED_VIOLATION_TYPES.includes(v.type);
        const screenshot = shouldCaptureScreenshot ? captureFromVideo(videoRef) : null;
        await apiClient.reportViolation({
          type: v.type,
          message: v.message,
          timestamp: v.timestamp,
          screenshot: screenshot || undefined,
          examSessionId,
        });
      } catch (error) {
        console.error("Failed to report violation:", error);
      }
    },
    [captureFromVideo, videoRef, examSessionId]
  );

  useBrowserMonitoring({
    enabled: !examFinished,
    onViolation: addViolation,
  });

  const {
    level: audioLevel,
    isActive: audioActive,
    error: audioError,
  } = useAudioMonitor({
    enabled: !examFinished,
    threshold: 20,
    onLoudNoise: useCallback(() => {
      addViolation({
        type: "loud-noise",
        message:
          "Loud noise detected from microphone (above 20% threshold)",
        timestamp: new Date(),
      });
    }, [addViolation]),
  });

  const aiDetection = useAIProctoring({
    videoRef,
    enabled: !examFinished && webcamActive,
    calibrationProfile,
    onViolation: useCallback(
      (type: string, message: string) => {
        addViolation({
          type: type as Violation["type"],
          message,
          timestamp: new Date(),
        });
      },
      [addViolation]
    ),
  });

  // Identity enrollment + continuous verification using AI detections
  useEffect(() => {
    if (examFinished || !webcamActive || identityBlockedRef.current) return;

    const detection = aiDetection as AIDetection;
    if (!detection.modelLoaded) return;

    const baselines = identityDescriptorsRef.current;

    // Require exactly one clearly visible face with a bounding box and landmarks
    if (!detection.faceVisible || detection.faces !== 1 || !detection.faceBoxes.length) {
      // During verification, do not reset mismatch streak: brief no-face / multi-face during
      // a swap used to clear progress and prevent identity-mismatch from ever firing.
      if (baselines.length < IDENTITY_ENROLLMENT_SAMPLES) {
        identityMismatchStreakRef.current = 0;
      }
      return;
    }

    // Enrollment: skip obscured frames. After enrollment, we still compare every clear
    // single-face frame (including when gaze-away flags flicker) so swaps cannot clear
    // the mismatch streak by skipping checks.
    if (baselines.length < IDENTITY_ENROLLMENT_SAMPLES && detection.faceObscured) {
      return;
    }

    const faceBox = detection.faceBoxes[0];
    const landmarks = detection.faceLandmarks;
    const video = videoRef.current;
    if (!video) return;

    const pixelDescriptor = computePixelDescriptor(video, faceBox);
    if (!pixelDescriptor || pixelDescriptor.length === 0) return;

    const landmarkDescriptor =
      landmarks && landmarks.length >= 4
        ? computeLandmarkDescriptor(landmarks, faceBox)
        : null;
    const descriptor = combineDescriptors(pixelDescriptor, landmarkDescriptor);

    // Ensure descriptor type matches existing baselines (landmark vs pixel have different lengths)
    if (baselines.length > 0 && descriptor.length !== baselines[0].length) return;

    // Enrollment phase: collect N baseline samples
    if (baselines.length < IDENTITY_ENROLLMENT_SAMPLES) {
      baselines.push(descriptor);
      const count = baselines.length;
      setIdentitySamples(count);
      if (count === IDENTITY_ENROLLMENT_SAMPLES) {
        setIdentityStatus("verified");
      }
      return;
    }

    // Verification phase: compare current descriptor to baseline
    const similarity = robustIdentitySimilarity(descriptor, baselines);
    setLastIdentitySimilarity(similarity);

    const adaptiveIdentityThreshold = Math.max(
      0.82,
      IDENTITY_SIMILARITY_THRESHOLD -
        ((calibrationProfile?.lightingScore ?? 0.5) < 0.3 ? 0.02 : 0)
    );

    // When gaze/box flags say pose is uncertain, require a larger drop in similarity
    // before counting a mismatch (reduces false swap alerts for the enrolled user).
    const uncertainPose = detection.gazeAway || detection.faceObscured;
    const mismatchThreshold = uncertainPose
      ? Math.max(0.72, adaptiveIdentityThreshold - 0.1)
      : adaptiveIdentityThreshold;

    if (similarity < mismatchThreshold) {
      identityMismatchStreakRef.current += 1;
      if (identityMismatchStreakRef.current < IDENTITY_MISMATCH_CONSECUTIVE_LIMIT) {
        return;
      }

      identityBlockedRef.current = true;
      setIdentityStatus("blocked");

      addViolation({
        type: "identity-mismatch",
        message:
          "Identity verification failed — the person in front of the camera does not match the enrolled candidate.",
        timestamp: new Date(),
      });

      setExamFinished(true);
      toast({
        title: "⚠️ Identity verification failed",
        description:
          "The system detected a different person in front of the camera. The exam has been paused. Please contact your proctor.",
        variant: "destructive",
      });
      return;
    }

    identityMismatchStreakRef.current = 0;
  }, [
    aiDetection,
    calibrationProfile,
    examFinished,
    webcamActive,
    addViolation,
    toast,
    videoRef,
  ]);

  const handleSubmit = useCallback(async () => {
    setExamFinished(true);

    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    let videoRecordingData: string | null = null;
    try {
      videoRecordingData = await getRecordingBlob();
    } catch (error) {
      console.error("Failed to get recording:", error);
    }

    if (examSessionId && user) {
      try {
        await apiClient.submitExamSession({
          sessionId: examSessionId,
          answers: {},
          videoRecordingData,
        });
      } catch (error) {
        console.error("Failed to submit exam session:", error);
      }
    }

    toast({
      title: "✅ Exam Submitted",
      description: `Completed with ${violations.length} violation(s).`,
    });
  }, [examSessionId, getRecordingBlob, toast, user, violations.length]);

  const handleTimeUp = useCallback(() => {
    toast({
      title: "⏰ Time's Up",
      description: "Your exam has been auto-submitted.",
      variant: "destructive",
    });
    handleSubmit();
  }, [handleSubmit, toast]);

  // When a critical violation occurs, automatically submit the exam
  useEffect(() => {
    if (!autoSubmitReason || examFinished) return;

    toast({
      title: "⚠️ Exam auto-submitted",
      description: autoSubmitReason,
      variant: "destructive",
    });

    handleSubmit();
  }, [autoSubmitReason, examFinished, handleSubmit, toast]);

  const handleExitExam = useCallback(() => {
    const confirmExit = window.confirm(
      "Are you sure you want to exit the exam? Your current attempt will be submitted and you will not be able to continue."
    );
    if (!confirmExit) return;
    handleSubmit();
  }, [handleSubmit]);

  return (
    <div className={`min-h-screen gradient-hero ${largeTextMode ? "text-[17px]" : ""} ${highContrastMode ? "contrast-125 saturate-110" : ""}`}>
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold text-foreground">Anticheating</span>
        </div>
        <div className="flex items-center gap-3">
          {aiDetection.modelLoaded && (
            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
              AI ACTIVE
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono">
            SESSION {examFinished ? "ENDED" : "ACTIVE"}
          </span>
          {!examFinished && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={handleExitExam}
            >
              Exit Exam
            </Button>
          )}
        </div>
      </header>

      {/* Main grid */}
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Questions & violations */}
        <div className="lg:col-span-2 space-y-4 relative">
          {identityStatus !== "verified" && !examFinished && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="gradient-card rounded-xl p-6 max-w-md w-full text-center space-y-4">
                <h2 className="text-xl font-semibold text-foreground">
                  {identityStatus === "blocked"
                    ? "Identity verification failed"
                    : "Verifying your identity"}
                </h2>
                {identityStatus === "blocked" ? (
                  <p className="text-sm text-destructive">
                    The system detected that the person in front of the camera
                    does not match the enrolled candidate. The exam has been
                    paused. Please contact your examiner or proctor.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Please look straight at the camera while we capture a few
                      quick reference photos for identity verification.
                    </p>
                    <p className="text-sm font-mono text-foreground">
                      Captured reference photos:{" "}
                      <span className="font-bold">
                        {identitySamples}/{IDENTITY_ENROLLMENT_SAMPLES}
                      </span>
                    </p>
                    {lastIdentitySimilarity !== null && identityStatus === "verified" && (
                      <p className="text-xs text-muted-foreground">
                        Identity similarity:{" "}
                        {(lastIdentitySimilarity * 100).toFixed(1)}%
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          <ExamQuestions onSubmit={handleSubmit} />
          <ViolationLog violations={violations} />
        </div>

        {/* Right: Monitoring sidebar */}
        <div className="space-y-4">
          <ExamTimer
            durationMinutes={30}
            running={!examFinished && identityStatus === "verified"}
            onTimeUp={handleTimeUp}
          />
          <MonitoringStatus
            webcamActive={webcamActive}
            audioActive={audioActive}
            browserMonitoring
            violationCount={violations.length}
            mobilePhoneViolationCount={
              violations.filter((v) => v.type === "prohibited-object").length
            }
            aiModelLoaded={aiDetection.modelLoaded}
          />
          <WebcamMonitor
            videoRef={videoRef}
            isActive={webcamActive}
            error={webcamError}
            detection={aiDetection}
          />
          <AudioLevelMeter
            level={audioLevel}
            isActive={audioActive}
            error={audioError}
          />
          {isRecording && (
            <div className="gradient-card rounded-lg p-3 text-xs text-muted-foreground">
              Recording exam session… {recordingTime}s
            </div>
          )}
        </div>
      </div>
      <UserExamAssistant
        context="exam"
        webcamActive={webcamActive}
        audioActive={audioActive}
        detection={aiDetection}
        latestViolation={violations.length > 0 ? violations[violations.length - 1] : null}
        webcamError={webcamError}
        audioError={audioError}
        onLargeTextChange={setLargeTextMode}
        onHighContrastChange={setHighContrastMode}
        compactByDefault
        floating
      />
    </div>
  );
}

