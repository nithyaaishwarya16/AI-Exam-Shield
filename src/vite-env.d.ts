/// <reference types="vite/client" />

declare global {
  interface Window {
    examShield?: {
      isDesktopShell: boolean;
      checkProhibitedProcesses: () => Promise<
        Array<{
          id: string;
          displayName: string;
          running: boolean;
          matchedExecutable: string | null;
          note: string | null;
        }>
      >;
    };
  }
}

export {};
