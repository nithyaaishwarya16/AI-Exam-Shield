import { useState, useRef, useCallback, useEffect } from "react";

interface UseAudioMonitorProps {
  enabled: boolean;
  threshold?: number;
  onLoudNoise?: () => void;
}

export function useAudioMonitor({
  enabled,
  threshold = 20,
  onLoudNoise,
}: UseAudioMonitorProps) {
  const [level, setLevel] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const onLoudRef = useRef(onLoudNoise);
  onLoudRef.current = onLoudNoise;
  const lastLoudRef = useRef(0);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const avg =
          dataArray.reduce((a, b) => a + b, 0) / dataArray.length || 0;
        const normalized = Math.min(100, (avg / 128) * 100);

        setLevel(normalized);

        if (normalized > threshold) {
          const now = Date.now();
          if (now - lastLoudRef.current > 5000) {
            lastLoudRef.current = now;
            onLoudRef.current?.();
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      tick();
      setIsActive(true);
      setError(null);
    } catch {
      setError("Microphone access denied.");
      setIsActive(false);
    }
  }, [threshold]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();
    setIsActive(false);
    setLevel(0);
  }, []);

  useEffect(() => {
    if (enabled && !isActive) start();
    if (!enabled && isActive) stop();
  }, [enabled, isActive, start, stop]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  return { level, isActive, error };
}

