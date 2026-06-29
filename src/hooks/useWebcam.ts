import { useState, useRef, useCallback, useEffect } from "react";

export function useWebcam() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      
      // Set stream to video element if it exists
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays
        videoRef.current.play().catch((err) => {
          console.error("Error playing video:", err);
        });
      }
      
      setIsActive(true);
      setError(null);
    } catch (err) {
      setError("Camera access denied. Please allow camera access.");
      setIsActive(false);
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    setIsActive(false);
  }, []);

  // Sync stream to video element when active state changes
  useEffect(() => {
    if (!isActive) return;
    
    const video = videoRef.current;
    const stream = streamRef.current;
    
    if (video && stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      // Ensure video plays
      if (video.paused) {
        video.play().catch((err) => {
          console.error("Error playing video:", err);
        });
      }
    }
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, isActive, error, start, stop };
}
