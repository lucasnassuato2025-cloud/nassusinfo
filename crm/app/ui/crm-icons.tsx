import type { SVGProps } from "react";

export type CRMIconName =
  | "home"
  | "target"
  | "users"
  | "folder"
  | "wallet"
  | "sparkles"
  | "user"
  | "infrastructure"
  | "calendar"
  | "document"
  | "installments"
  | "bell"
  | "chart"
  | "search"
  | "plus"
  | "arrow-left"
  | "logout"
  | "more"
  | "check"
  | "shield"
  | "sync";

type Props = SVGProps<SVGSVGElement> & { name: CRMIconName };

const paths: Record<CRMIconName, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-7h6v7"/></>,
  target: <><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  folder: <><path d="M3 5.5h6l2 2H21v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/></>,
  wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 8h15M15 12h6v4h-6a2 2 0 0 1 0-4Z"/></>,
  sparkles: <><path d="m12 3 1.2 3.1L16 7.5l-2.8 1.4L12 12l-1.2-3.1L8 7.5l2.8-1.4Z"/><path d="m18.5 13 1 2.3L22 16.5l-2.5 1.2-1 2.3-1-2.3-2.5-1.2 2.5-1.2ZM5.5 12l.8 2L8 15l-1.7 1-.8 2-.8-2L3 15l1.7-1Z"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  infrastructure: <><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 16 2 2 4-5"/></>,
  document: <><path d="M6 2.5h8l4 4V21H6z"/><path d="M14 2.5v4h4M9 12h6M9 16h6M9 8h2"/></>,
  installments: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  "arrow-left": <><path d="m15 18-6-6 6-6"/><path d="M9 12h11"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></>,
  sync: <><path d="M20 7h-5V2"/><path d="M20 7a8 8 0 1 0 1 8"/></>,
};

export function CRMIcon({ name, ...props }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
