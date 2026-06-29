import { useState, useRef, useCallback, useEffect } from "react";

interface UseVideoRecordingProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  onRecordingComplete?: (blob: Blob) => void;
}

export function useVideoRecording({
  videoRef,
  enabled,
  onRecordingComplete,
}: UseVideoRecordingProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const video = videoRef.current;
      if (!video || !video.srcObject) {
        console.error("Video element or stream not available");
        return;
      }

      const stream = video.srcObject as MediaStream;
      streamRef.current = stream;

      // Create MediaRecorder
      const options: MediaRecorderOptions = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      };

      // Fallback to default if codec not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
        options.mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (onRecordingComplete) {
          onRecordingComplete(blob);
        }
        chunksRef.current = [];
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      // Update recording time
      intervalRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [videoRef, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isRecording]);

  const getRecordingBlob = useCallback(async (): Promise<string | null> => {
    if (chunksRef.current.length === 0) return null;

    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    
    // Convert blob to base64 for storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }, []);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && !isRecording) {
      startRecording();
    } else if (!enabled && isRecording) {
      stopRecording();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [stopRecording]);

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    getRecordingBlob,
  };
}
