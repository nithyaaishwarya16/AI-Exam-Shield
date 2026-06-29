export type ProcessScanResult = {
  id: string;
  displayName: string;
  running: boolean;
  matchedExecutable: string | null;
  note: string | null;
};
