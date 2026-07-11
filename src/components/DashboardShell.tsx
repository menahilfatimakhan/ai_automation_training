"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";

export interface NavLink {
  href: string;
  label: string;
  icon: IconKey;
}

type IconKey =
  | "master"
  | "sales"
  | "setter"
  | "ads"
  | "callLogs"
  | "leads"
  | "reports"
  | "admin";

function Icon({ name }: { name: IconKey }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "master":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "sales":
      return (
        <svg {...common}>
          <path d="M3 17l5-5 4 4 8-8" />
          <path d="M16 8h5v5" />
        </svg>
      );
    case "setter":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-5.1A8.4 8.4 0 1 1 21 11.5z" />
        </svg>
      );
    case "ads":
      return (
        <svg {...common}>
          <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V7L6 11H4a1 1 0 0 0-1 0z" />
          <path d="M15 8a5 5 0 0 1 0 8" />
        </svg>
      );
    case "callLogs":
      return (
        <svg {...common}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="3.5" cy="6" r="1" />
          <circle cx="3.5" cy="12" r="1" />
          <circle cx="3.5" cy="18" r="1" />
        </svg>
      );
    case "leads":
      return (
        <svg {...common}>
          <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
          <circle cx="9" cy="7" r="3" />
          <path d="M22 19v-1a4 4 0 0 0-3-3.9" />
          <path d="M16 4.1a4 4 0 0 1 0 7.8" />
        </svg>
      );
    case "reports":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 6 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 9H4.5a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 6 4.6L5.9 4.5A2 2 0 1 1 8.7 1.7l.1.1A1.7 1.7 0 0 0 11 3h.1A1.7 1.7 0 0 0 12 1.5" />
        </svg>
      );
  }
}

export function DashboardShell({
  links,
  userLabel,
  children,
  slackConnected,
  slackWorkspaceUrl,
}: {
  links: NavLink[];
  userLabel: string;
  children: React.ReactNode;
  /** Admin only — omit (undefined) to hide the badge entirely for non-admins. */
  slackConnected?: boolean;
  /** The real workspace URL (resolved from the bot token) — lets the badge open Slack itself. */
  slackWorkspaceUrl?: string | null;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const navItems = (
    <>
      {links.map((l) => {
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
              active
                ? "bg-brand-soft text-ink"
                : "text-ink-soft hover:bg-surface-raised hover:text-ink"
            }`}
          >
            <span
              className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-all duration-200 ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
            <span
              className={`transition-transform duration-200 group-hover:scale-110 ${
                active ? "text-brand" : "text-ink-faint group-hover:text-ink-soft"
              }`}
            >
              <Icon name={l.icon} />
            </span>
            {l.label}
          </Link>
        );
      })}
    </>
  );

  const SlackIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v4A2.5 2.5 0 0 0 9.5 11h1V4.5A2.5 2.5 0 0 0 9.5 2Z" opacity=".55" />
      <path d="M4.5 7A2.5 2.5 0 0 0 2 9.5 2.5 2.5 0 0 0 4.5 12h4A2.5 2.5 0 0 0 11 9.5v-1H4.5Z" opacity=".85" />
      <path d="M14.5 22a2.5 2.5 0 0 0 2.5-2.5v-4A2.5 2.5 0 0 0 14.5 13h-1v6.5a2.5 2.5 0 0 0 2.5 2.5Z" opacity=".55" />
      <path d="M19.5 17A2.5 2.5 0 0 0 22 14.5 2.5 2.5 0 0 0 19.5 12h-4a2.5 2.5 0 0 0-2.5 2.5v1h6.5Z" opacity=".85" />
      <path d="M22 9.5A2.5 2.5 0 0 0 19.5 7h-4v4h4A2.5 2.5 0 0 0 22 9.5Z" opacity=".7" />
      <path d="M17 4.5A2.5 2.5 0 0 0 14.5 2 2.5 2.5 0 0 0 12 4.5v4h2.5A2.5 2.5 0 0 0 17 8V4.5Z" opacity=".4" />
      <path d="M2 14.5A2.5 2.5 0 0 0 4.5 17h4v-4h-4A2.5 2.5 0 0 0 2 14.5Z" opacity=".4" />
      <path d="M7 19.5A2.5 2.5 0 0 0 9.5 22 2.5 2.5 0 0 0 12 19.5v-4H9.5A2.5 2.5 0 0 0 7 18v1.5Z" opacity=".7" />
    </svg>
  );

  // Connected + we resolved a real workspace URL → clicking opens Slack
  // itself in a new tab. Otherwise it falls back to our own Slack settings
  // page (either to see why it's not connecting, or to set it up).
  const slackHref = slackConnected && slackWorkspaceUrl ? slackWorkspaceUrl : "/dashboard/admin";
  const opensExternally = slackConnected && !!slackWorkspaceUrl;

  const slackBadge = slackConnected !== undefined && (
    <div
      className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
        slackConnected
          ? "border-accent-green/25 bg-accent-green/10 text-accent-green"
          : "border-line text-ink-faint"
      }`}
    >
      <Link
        href={slackHref}
        target={opensExternally ? "_blank" : undefined}
        rel={opensExternally ? "noopener noreferrer" : undefined}
        className={`flex flex-1 items-center gap-2 truncate ${
          slackConnected ? "hover:text-accent-green/80" : "hover:text-ink-soft"
        }`}
        title={
          opensExternally
            ? "Open your Slack workspace ↗"
            : slackConnected
              ? "Slack connected — click to manage"
              : "Slack not connected — click to set up"
        }
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${slackConnected ? "bg-accent-green" : "bg-ink-faint"}`} />
        {SlackIcon}
        <span className="truncate">{slackConnected ? "Open Slack" : "Slack not connected"}</span>
        {opensExternally && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="ml-auto shrink-0 opacity-70">
            <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </Link>
      {opensExternally && (
        <Link
          href="/dashboard/admin"
          className="shrink-0 text-ink-faint transition-colors hover:text-ink-soft"
          title="Slack settings"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 6 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 9H4.5a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 6 4.6L5.9 4.5A2 2 0 1 1 8.7 1.7l.1.1A1.7 1.7 0 0 0 11 3h.1A1.7 1.7 0 0 0 12 1.5" />
          </svg>
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface/60 px-3 py-5 md:flex">
        <div className="group flex items-center gap-2 px-2 pb-6">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-bold text-white transition-transform duration-300 group-hover:rotate-[8deg] group-hover:scale-105">
            N
          </span>
          <span className="text-[15px] font-semibold tracking-tight">NEW SZN</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">{navItems}</nav>

        <div className="group relative mb-4 overflow-hidden rounded-xl border border-brand/20 bg-gradient-to-b from-brand-soft to-transparent p-3 transition-colors hover:border-brand/35">
          <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-brand/20 blur-2xl [animation:soft-pulse_3s_ease-in-out_infinite]" />
          <div className="relative flex items-center gap-1.5 text-xs font-semibold">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-brand transition-transform duration-300 group-hover:scale-110">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
            </svg>
            New season energy
          </div>
          <p className="relative mt-1 text-[11px] text-ink-soft">Keep the numbers moving.</p>
        </div>

        <div className="mt-1 border-t border-line pt-4">
          {slackBadge}
          <div className="truncate px-3 pb-2 text-xs text-ink-faint">{userLabel}</div>
          <form action={signOut}>
            <button className="btn-ghost w-full justify-start">Sign out</button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface/60 px-4 py-3 md:hidden">
          <span className="font-semibold tracking-tight">NEW SZN</span>
          <form action={signOut}>
            <button className="btn-subtle text-xs">Sign out</button>
          </form>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
                isActive(l.href)
                  ? "bg-brand-soft text-ink"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
