import { useCallback } from "react";

/**
 * Captures a screenshot from the webcam video element when a violation occurs.
 * Returns base64 image data for sending to backend.
 */
export function useScreenshotCapture() {
  const captureFromVideo = useCallback(
    (videoRef: React.RefObject<HTMLVideoElement | null>): string | null => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return null;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.drawImage(video, 0, 0);
        return canvas.toDataURL("image/jpeg", 0.8);
      } catch (err) {
        console.error("Screenshot capture failed:", err);
        return null;
      }
    },
    []
  );

  return { captureFromVideo };
}
