import { Camera, CameraOff, Brain } from "lucide-react";
import type { AIDetection } from "@/hooks/useAIProctoring";

interface WebcamMonitorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  error: string | null;
  detection?: AIDetection;
}

export function WebcamMonitor({ videoRef, isActive, error, detection }: WebcamMonitorProps) {
  return (
    <div className="gradient-card rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {isActive ? (
          <Camera className="w-4 h-4 text-primary" />
        ) : (
          <CameraOff className="w-4 h-4 text-destructive" />
        )}
        <span className="text-sm font-medium text-foreground">Webcam Feed</span>
        {detection?.modelLoaded && (
          <Brain className="w-3.5 h-3.5 text-primary" />
        )}
        <span className={`ml-auto w-2 h-2 rounded-full ${isActive ? "bg-success pulse-dot" : "bg-destructive"}`} />
      </div>
      <div className="relative aspect-video bg-background flex items-center justify-center">
        {error ? (
          <p className="text-destructive text-sm px-4 text-center">{error}</p>
        ) : !isActive ? (
          <p className="text-muted-foreground text-sm">Camera inactive</p>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                video.play().catch((err) => {
                  console.error("Error playing video:", err);
                });
              }}
              onCanPlay={(e) => {
                const video = e.currentTarget;
                if (video.paused) {
                  video.play().catch((err) => {
                    console.error("Error playing video:", err);
                  });
                }
              }}
            />
            {/* Scan line overlay */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="scan-line w-full h-0.5 bg-primary/30" />
            </div>
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-background/80 rounded px-2 py-1">
              <span className="w-2 h-2 rounded-full bg-destructive pulse-dot" />
              <span className="text-xs font-medium text-foreground">LIVE</span>
            </div>
            {/* Bounding boxes for detected objects */}
            {detection?.detectedObjects && detection.detectedObjects.length > 0 && videoRef.current && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 10 }}
                viewBox={`0 0 ${videoRef.current.clientWidth} ${videoRef.current.clientHeight}`}
                preserveAspectRatio="none"
              >
                {detection.detectedObjects.map((obj, i) => {
                  const [x, y, width, height] = obj.bbox;
                  const video = videoRef.current;
                  if (!video || !video.videoWidth || !video.videoHeight) return null;
                  
                  // Scale coordinates from video resolution to display size
                  const videoWidth = video.videoWidth;
                  const videoHeight = video.videoHeight;
                  const displayWidth = video.clientWidth;
                  const displayHeight = video.clientHeight;
                  
                  const scaleX = displayWidth / videoWidth;
                  const scaleY = displayHeight / videoHeight;
                  
                  const scaledX = x * scaleX;
                  const scaledY = y * scaleY;
                  const scaledWidth = width * scaleX;
                  const scaledHeight = height * scaleY;
                  
                  return (
                    <g key={i}>
                      <rect
                        x={scaledX}
                        y={scaledY}
                        width={scaledWidth}
                        height={scaledHeight}
                        fill="none"
                        stroke="rgb(239, 68, 68)"
                        strokeWidth="3"
                        strokeDasharray="5,5"
                        className="animate-pulse"
                      />
                      <rect
                        x={scaledX}
                        y={Math.max(0, scaledY - 20)}
                        width={Math.max(scaledWidth, 120)}
                        height="20"
                        fill="rgba(239, 68, 68, 0.9)"
                      />
                      <text
                        x={scaledX + 5}
                        y={Math.max(15, scaledY - 5)}
                        fill="white"
                        fontSize="12"
                        fontWeight="bold"
                        className="uppercase"
                      >
                        {obj.class} ({(obj.score * 100).toFixed(0)}%)
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
            
            {/* Face count indicator for multiple faces */}
            {detection?.faces && detection.faces > 1 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-destructive/90 text-foreground px-4 py-2 rounded-lg border-4 border-destructive animate-pulse">
                  <div className="text-lg font-bold text-center">
                    ⚠️ {detection.faces} FACES DETECTED
                  </div>
                  <div className="text-sm text-center mt-1">Only one person allowed</div>
                </div>
              </div>
            )}

            {/* AI Detection overlay */}
            {detection && (
              <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 z-20">
                {!detection.modelLoaded && (
                  <span className="text-[10px] bg-muted/90 text-muted-foreground px-1.5 py-0.5 rounded font-medium animate-pulse">
                    AI Loading…
                  </span>
                )}
                {detection.modelLoaded && !detection.faceVisible && (
                  <span className="text-[10px] bg-destructive/90 text-foreground px-1.5 py-0.5 rounded font-medium">
                    NO FACE
                  </span>
                )}
                {detection.faces > 1 && (
                  <span className="text-[10px] bg-destructive/90 text-foreground px-1.5 py-0.5 rounded font-medium animate-pulse">
                    ⚠️ {detection.faces} FACES
                  </span>
                )}
                {detection.gazeAway && (
                  <span className="text-[10px] bg-warning/90 text-foreground px-1.5 py-0.5 rounded font-medium">
                    LOOKING AWAY
                  </span>
                )}
                {detection.faceObscured && (
                  <span className="text-[10px] bg-warning/90 text-foreground px-1.5 py-0.5 rounded font-medium">
                    FACE UNCLEAR
                  </span>
                )}
                {detection.prohibitedObjects.map((obj, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-destructive/90 text-foreground px-1.5 py-0.5 rounded font-medium uppercase animate-pulse"
                  >
                    🚫 {obj}
                  </span>
                ))}
                {detection.modelLoaded &&
                  detection.faceVisible &&
                  detection.faces === 1 &&
                  !detection.gazeAway &&
                  !detection.faceObscured &&
                  detection.prohibitedObjects.length === 0 && (
                    <span className="text-[10px] bg-success/90 text-foreground px-1.5 py-0.5 rounded font-medium">
                      ✓ CLEAR
                    </span>
                  )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
