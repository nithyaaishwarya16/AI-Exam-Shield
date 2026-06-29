/** Apps commonly used to communicate or remote-control during exams. */
export type ProhibitedApp = {
  id: string;
  displayName: string;
  /** Windows image names from Task Manager (case-insensitive). */
  windowsExecutables: string[];
  /** Substrings matched against `ps` command name on macOS (case-insensitive). */
  darwinIncludes?: string[];
};

export const PROHIBITED_APPS: ProhibitedApp[] = [
  {
    id: "teams",
    displayName: "Microsoft Teams",
    windowsExecutables: ["Teams.exe", "ms-teams.exe"],
    darwinIncludes: ["Teams", "MSTeams", "Microsoft Teams"],
  },
  {
    id: "zoom",
    displayName: "Zoom",
    windowsExecutables: ["Zoom.exe"],
    darwinIncludes: ["zoom.us", "ZoomOpener"],
  },
  {
    id: "discord",
    displayName: "Discord",
    windowsExecutables: ["Discord.exe"],
    darwinIncludes: ["Discord"],
  },
  {
    id: "slack",
    displayName: "Slack",
    windowsExecutables: ["slack.exe"],
    darwinIncludes: ["Slack"],
  },
  {
    id: "skype",
    displayName: "Skype",
    windowsExecutables: ["Skype.exe", "SkypeApp.exe"],
    darwinIncludes: ["Skype"],
  },
  {
    id: "anydesk",
    displayName: "AnyDesk",
    windowsExecutables: ["AnyDesk.exe"],
    darwinIncludes: ["anydesk"],
  },
  {
    id: "teamviewer",
    displayName: "TeamViewer",
    windowsExecutables: ["TeamViewer.exe"],
    darwinIncludes: ["TeamViewer"],
  },
  {
    id: "webex",
    displayName: "Webex",
    windowsExecutables: ["CiscoCollabHost.exe", "WebexHost.exe", "atmgr.exe"],
    darwinIncludes: ["Webex", "CiscoCollabHost"],
  },
];
