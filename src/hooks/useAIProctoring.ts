import { useState, useRef, useCallback, useEffect } from "react";

export interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

/** BlazeFace landmarks: [rightEye, leftEye, nose, mouth, rightEar, leftEar] - each [x, y] */
export type FaceLandmarks = [number, number][];

export interface AIDetection {
  faces: number;
  faceVisible: boolean;
  gazeAway: boolean;
  prohibitedObjects: string[];
  detectedObjects: DetectedObject[];
  faceObscured: boolean;
  modelLoaded: boolean;
  faceBoxes: [number, number, number, number][];
  /** Landmarks for primary face when exactly 1 face detected */
  faceLandmarks: FaceLandmarks | null;
  confidenceScores: {
    faceVisibility: number;
    gazeAway: number;
    faceObscured: number;
    multipleFaces: number;
    prohibitedObject: number;
  };
}

export interface ProctoringCalibrationProfile {
  lightingScore?: number;
  micBaseline?: number;
  faceCenteredScore?: number;
}

interface UseAIProctoringProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  onViolation: (type: string, message: string) => void;
  intervalMs?: number;
  calibrationProfile?: ProctoringCalibrationProfile | null;
}

export function useAIProctoring({
  videoRef,
  enabled,
  onViolation,
  intervalMs = 2000,
  calibrationProfile = null,
}: UseAIProctoringProps): AIDetection {
  const [detection, setDetection] = useState<AIDetection>({
    faces: 0,
    faceVisible: false,
    gazeAway: false,
    prohibitedObjects: [],
    detectedObjects: [],
    faceObscured: false,
    modelLoaded: false,
    faceBoxes: [],
    faceLandmarks: null,
    confidenceScores: {
      faceVisibility: 0,
      gazeAway: 0,
      faceObscured: 0,
      multipleFaces: 0,
      prohibitedObject: 0,
    },
  });

  const cocoModelRef = useRef<any>(null);
  const blazefaceModelRef = useRef<any>(null);
  const intervalRef = useRef<number>(0);
  const lastViolationRef = useRef<Record<string, number>>({});
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const COOLDOWN_MS = 5000;
  const FACE_CONFIDENCE_THRESHOLD =
    (calibrationProfile?.lightingScore ?? 0.5) < 0.3 ? 0.72 : 0.8;
  const FACE_OBSCURED_THRESHOLD =
    (calibrationProfile?.lightingScore ?? 0.5) < 0.3 ? 0.65 : 0.75;
  const MIN_FACE_BOX_SIZE = 60; // ignore tiny false positives
  const GAZE_AWAY_GRACE_MS = 1500; // trigger sooner for real looking-away
  const GAZE_AWAY_REPEAT_MS = 5000; // repeat warning cooldown while still away
  const GAZE_NOSE_OFFSET_THRESHOLD =
    (calibrationProfile?.faceCenteredScore ?? 0.8) < 0.65 ? 0.3 : 0.25;
  const CRITICAL_VIOLATIONS = ["multiple-faces", "prohibited-object", "identity-mismatch"];
  const RULES: Record<string, { graceMs: number; cooldownMs: number }> = {
    "no-face": { graceMs: 1500, cooldownMs: 5000 },
    "multiple-faces": { graceMs: 1200, cooldownMs: 2500 },
    "prohibited-object": { graceMs: 1200, cooldownMs: 2500 },
    "face-obscured": { graceMs: 1500, cooldownMs: 5000 },
    "gaze-away": { graceMs: GAZE_AWAY_GRACE_MS, cooldownMs: GAZE_AWAY_REPEAT_MS },
  };
  const gazeAwayStartRef = useRef<number | null>(null);
  const gazeAwayLastAlertRef = useRef(0);
  const sustainedStartRef = useRef<Record<string, number>>({});

  const reportViolation = useCallback((type: string, message: string, forcedCooldownMs?: number) => {
    const now = Date.now();
    const last = lastViolationRef.current[type] || 0;
    const isCritical = CRITICAL_VIOLATIONS.includes(type);
    // Critical violations have shorter cooldown (2s) or no cooldown for multiple faces
    const cooldown =
      forcedCooldownMs ??
      (type === "multiple-faces" ? 0 : isCritical ? 2000 : COOLDOWN_MS);
    
    if (now - last > cooldown) {
      lastViolationRef.current[type] = now;
      onViolationRef.current(type, message);
    }
  }, []);

  const reportSustained = useCallback(
    (type: string, active: boolean, message: string) => {
      const now = Date.now();
      const rule = RULES[type] || { graceMs: 1000, cooldownMs: COOLDOWN_MS };
      if (!active) {
        delete sustainedStartRef.current[type];
        return;
      }
      if (!sustainedStartRef.current[type]) {
        sustainedStartRef.current[type] = now;
        return;
      }
      const duration = now - sustainedStartRef.current[type];
      if (duration >= rule.graceMs) {
        reportViolation(type, message, rule.cooldownMs);
      }
    },
    [COOLDOWN_MS, RULES, reportViolation]
  );

  // Load models
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function loadModels() {
      try {
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();

        const cocoSsd = await import("@tensorflow-models/coco-ssd");
        const blazeface = await import("@tensorflow-models/blazeface");

        const [cocoModel, faceModel] = await Promise.all([
          cocoSsd.load(),
          blazeface.load(),
        ]);

        if (!cancelled) {
          cocoModelRef.current = cocoModel;
          blazefaceModelRef.current = faceModel;
          setDetection((prev) => ({ ...prev, modelLoaded: true }));
        }
      } catch (err) {
        console.error("Failed to load AI models:", err);
      }
    }

    loadModels();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Detection loop
  useEffect(() => {
    if (!enabled || !detection.modelLoaded) return;

    const detect = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const [objects, faces] = await Promise.all([
          cocoModelRef.current?.detect(video),
          blazefaceModelRef.current?.estimateFaces(video, false),
        ]);

        // --- Object detection ---
        // Enhanced list of prohibited objects with mobile phone variations
        const prohibitedClasses = [
          "cell phone",
          "mobile phone",
          "phone",
          "book",
          "scissors",
          "knife",
          "remote",
          "laptop",
          "keyboard",
          "mouse",
          "handbag",
          "backpack",
        ];
        
        // Lower threshold for mobile phones (0.4) for better detection
        const detectedObjects = (objects || []).filter((obj: any) => {
          const isProhibited = prohibitedClasses.some((cls) =>
            obj.class.toLowerCase().includes(cls.toLowerCase())
          );
          // Lower threshold for phones, higher for other objects
          const threshold = obj.class.toLowerCase().includes("phone") ? 0.4 : 0.5;
          return isProhibited && obj.score > threshold;
        });

        const detectedProhibited = detectedObjects.map((obj: any) => {
          // Normalize phone-related detections
          if (obj.class.toLowerCase().includes("phone")) {
            return "MOBILE PHONE";
          }
          return obj.class.toUpperCase();
        });

        const prohibitedObjectConfidence = Math.max(
          0,
          ...(detectedObjects || []).map((obj: any) => Number(obj.score) || 0)
        );
        if (detectedProhibited.length > 0) {
          const uniqueObjects = [...new Set(detectedProhibited)];
          reportSustained(
            "prohibited-object",
            true,
            `Prohibited item detected: ${uniqueObjects.join(", ")}`
          );
        } else {
          reportSustained("prohibited-object", false, "");
        }

        // --- Face detection ---
        const rawFaces = faces || [];
        const validFaces = rawFaces.filter((face: any) => {
          const topLeft = face.topLeft as number[] | undefined;
          const bottomRight = face.bottomRight as number[] | undefined;
          if (!topLeft || !bottomRight) return false;

          const width = (bottomRight[0] || 0) - (topLeft[0] || 0);
          const height = (bottomRight[1] || 0) - (topLeft[1] || 0);
          if (width < MIN_FACE_BOX_SIZE || height < MIN_FACE_BOX_SIZE) return false;

          const prob = Array.isArray(face.probability)
            ? face.probability[0]
            : face.probability ?? 1;
          return prob >= FACE_CONFIDENCE_THRESHOLD;
        });

        const faceCount = validFaces.length;
        const faceVisible = faceCount > 0;
        let gazeAway = false;
        let faceObscured = false;
        const faceBoxes: [number, number, number, number][] = [];

        // Build face bounding boxes (x, y, width, height)
        for (const face of validFaces) {
          const topLeft = face.topLeft as number[] | undefined;
          const bottomRight = face.bottomRight as number[] | undefined;
          if (!topLeft || !bottomRight) continue;

          const x = topLeft[0] || 0;
          const y = topLeft[1] || 0;
          const width = (bottomRight[0] || 0) - x;
          const height = (bottomRight[1] || 0) - y;
          if (width > 0 && height > 0) {
            faceBoxes.push([x, y, width, height]);
          }
        }

        if (faceCount === 0) {
          gazeAwayStartRef.current = null;
          reportSustained("multiple-faces", false, "");
          reportSustained("no-face", true, "No face detected in webcam");
        } else if (faceCount > 1) {
          gazeAwayStartRef.current = null;
          reportSustained("no-face", false, "");
          reportSustained(
            "multiple-faces",
            true,
            `⚠️ VIOLATION: ${faceCount} faces detected — only one person allowed in frame`
          );
        } else {
          reportSustained("no-face", false, "");
          reportSustained("multiple-faces", false, "");
        }

        if (faceCount === 1 && validFaces[0]) {
          const face = validFaces[0];
          const prob = Array.isArray(face.probability)
            ? face.probability[0]
            : face.probability ?? 1;
          const gazeReasons: string[] = [];

          // Face obscured if low confidence
          if (prob < FACE_OBSCURED_THRESHOLD) {
            faceObscured = true;
            reportSustained(
              "face-obscured",
              true,
              "Face not clearly visible — adjust your camera"
            );
          } else {
            reportSustained("face-obscured", false, "");
          }

          // Frame-position based check (works even if landmarks are partial)
          const topLeft = face.topLeft as number[] | undefined;
          const bottomRight = face.bottomRight as number[] | undefined;
          if (topLeft && bottomRight) {
            const videoWidth = video.videoWidth || 640;
            const videoHeight = video.videoHeight || 480;
            const faceCenterX = (topLeft[0] + bottomRight[0]) / 2;
            const faceCenterY = (topLeft[1] + bottomRight[1]) / 2;
            const relX = faceCenterX / videoWidth;
            const relY = faceCenterY / videoHeight;

            // Stricter central-zone requirement to better catch looking away/posture drift
            if (relX < 0.2 || relX > 0.8 || relY < 0.2 || relY > 0.8) {
              gazeAway = true;
              gazeReasons.push("face moved away from center");
            }
          }

          // Gaze estimation from BlazeFace landmarks
          // landmarks: [rightEye, leftEye, nose, mouth, rightEar, leftEar]
          if (face.landmarks && face.landmarks.length >= 3) {
            const rightEye = face.landmarks[0];
            const leftEye = face.landmarks[1];
            const nose = face.landmarks[2];

            const eyeMidX = (rightEye[0] + leftEye[0]) / 2;
            const eyeMidY = (rightEye[1] + leftEye[1]) / 2;
            const eyeDistance = Math.hypot(
              rightEye[0] - leftEye[0],
              rightEye[1] - leftEye[1]
            );

            if (eyeDistance > 0) {
              const noseOffset = Math.abs(eyeMidX - nose[0]) / eyeDistance;
              const noseYOffset = Math.abs(eyeMidY - nose[1]) / eyeDistance;
              // Head turned significantly
              if (noseOffset > GAZE_NOSE_OFFSET_THRESHOLD) {
                gazeAway = true;
                gazeReasons.push("head turned away from screen");
              }
              if (noseYOffset > 0.45) {
                gazeAway = true;
                gazeReasons.push("head tilted up/down from screen");
              }
            }

            if (face.landmarks.length >= 4) {
              const mouth = face.landmarks[3];
              const eyeToMouth = Math.hypot(
                eyeMidX - mouth[0],
                eyeMidY - mouth[1]
              );
              const eyeToNose = Math.hypot(eyeMidX - nose[0], eyeMidY - nose[1]);
              if (eyeToNose > 0 && eyeToMouth / eyeToNose > 2.4) {
                gazeAway = true;
                gazeReasons.push("head pitched down significantly");
              }
            }
          } else {
            // If landmarks are unavailable for the primary face, treat as potentially away/unclear.
            // This prevents silent misses when user turns too far.
            if (prob < 0.9) {
              gazeAway = true;
              gazeReasons.push("facial landmarks unstable");
            }
          }

          // Duration-based gaze-away handling to avoid false positives from brief glances.
          const now = Date.now();
          if (gazeAway) {
            if (!gazeAwayStartRef.current) {
              gazeAwayStartRef.current = now;
            }
            const awayFor = now - gazeAwayStartRef.current;
            if (
              awayFor >= GAZE_AWAY_GRACE_MS &&
              now - gazeAwayLastAlertRef.current >= GAZE_AWAY_REPEAT_MS
            ) {
              gazeAwayLastAlertRef.current = now;
              const reasonText =
                gazeReasons.length > 0
                  ? gazeReasons.join(", ")
                  : "looking away from screen";
              reportViolation(
                "gaze-away",
                `Looking away detected for ${(awayFor / 1000).toFixed(
                  1
                )}s (${reasonText})`
              );
            }
          } else {
            gazeAwayStartRef.current = null;
          }
        }

        const primaryFace = faceCount === 1 ? validFaces[0] : null;
        const faceLandmarks: FaceLandmarks | null =
          primaryFace?.landmarks && Array.isArray(primaryFace.landmarks) && primaryFace.landmarks.length >= 4
            ? (primaryFace.landmarks as FaceLandmarks)
            : null;

        setDetection({
          faces: faceCount,
          faceVisible,
          gazeAway,
          prohibitedObjects: detectedProhibited,
          detectedObjects: detectedObjects
            .filter((obj: any) => obj.bbox && Array.isArray(obj.bbox) && obj.bbox.length >= 4)
            .map((obj: any) => ({
              class: obj.class,
              score: obj.score,
              bbox: [
                obj.bbox[0] || 0, // x
                obj.bbox[1] || 0, // y
                obj.bbox[2] || 0, // width
                obj.bbox[3] || 0, // height
              ] as [number, number, number, number],
            })),
          faceObscured,
          modelLoaded: true,
          faceBoxes,
          faceLandmarks,
          confidenceScores: {
            faceVisibility:
              faceCount === 1 && validFaces[0]
                ? Array.isArray(validFaces[0].probability)
                  ? Number(validFaces[0].probability[0] || 0)
                  : Number(validFaces[0].probability ?? 1)
                : faceCount > 0
                  ? 0.6
                  : 0,
            gazeAway: gazeAway ? 0.85 : 0.15,
            faceObscured:
              faceCount === 1 && validFaces[0]
                ? Math.max(
                    0,
                    1 -
                      (Array.isArray(validFaces[0].probability)
                        ? Number(validFaces[0].probability[0] || 0)
                        : Number(validFaces[0].probability ?? 1))
                  )
                : 0.2,
            multipleFaces: faceCount > 1 ? Math.min(1, 0.5 + (faceCount - 1) * 0.25) : 0,
            prohibitedObject: prohibitedObjectConfidence,
          },
        });
      } catch (err) {
        console.error("AI detection error:", err);
      }
    };

    detect();
    intervalRef.current = window.setInterval(detect, intervalMs);

    return () => {
      window.clearInterval(intervalRef.current);
    };
  }, [enabled, detection.modelLoaded, videoRef, intervalMs, reportViolation, reportSustained, FACE_OBSCURED_THRESHOLD, GAZE_NOSE_OFFSET_THRESHOLD]);

  return detection;
}
