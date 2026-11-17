import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import DenAvatar from "./DenAvatar";
import { useCurrentUser } from "../lib/currentUser";
import { denHref, listDens } from "../lib/dens";
import { useUnreadMessages } from "../lib/messages";
import type { Den } from "../lib/dens";

interface SideNavProps {
  /** "fixed": pinned to the left edge on wide screens. "drawer": inside the slide-in menu. */
  variant?: "fixed" | "drawer";
}

// Collapsed sections are remembered per browser (just a convenience)
const COLLAPSED_KEY = "wolflite-sidenav-collapsed";

function readCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeCollapsed(sections: string[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(sections));
  } catch {
    // Not saved; it still works for this page
  }
}

/*
  Side navigation (left edge on wide screens, slide-in drawer on narrow ones):
    Home, Discover, Explore dens, Create a den
    YOUR DENS   the dens you joined (logged in only)     collapsible
    WOLFLITE    About Wolf, Help                          collapsible
  Explore dens / About / Help are views of the feed page (/blog?tab=...).
*/
export default function SideNav({ variant = "fixed" }: SideNavProps) {
  const user = useCurrentUser();
  const [dens, setDens] = useState<Den[] | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  const unreadMessages = useUnreadMessages(!!user);

  useEffect(() => {
    if (!user) return;
    listDens(true)
      .then(setDens)
      .catch(() => setDens([]));
  }, [user]);

  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const onFeed = (name: string | null) => path === "/blog" && tab === name;
  const currentDen = path === "/den" ? params.get("name")?.toLowerCase() : undefined;

  function toggle(section: string) {
    setCollapsed((prev) => {
      const next = prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section];
      writeCollapsed(next);
      return next;
    });
  }

  const top: { label: string; icon: string; href: string; current: boolean; badge?: number }[] = [
    // Home is the feed itself (guests see Discover there)
    { label: "Home", icon: "fa-house", href: "/blog", current: onFeed(null) || (path === "/blog" && tab === "home") },
    { label: "Discover", icon: "fa-compass", href: "/blog?tab=discover", current: onFeed("discover") },
    // Direct messages (logged in only), with the unread count
    ...(user
      ? [{ label: "Messages", icon: "fa-message", href: "/messages", current: path === "/messages", badge: unreadMessages }]
      : []),
    { label: "Explore dens", icon: "fa-people-group", href: "/blog?tab=dens", current: onFeed("dens") },
    {
      label: "Create a den",
      icon: "fa-plus",
      href: "/create?type=den",
      current: path === "/create" && params.get("type") === "den",
    },
  ];

  return (
    <nav className={`side-nav is-${variant}`} aria-label="Side navigation">
      <ul className="side-nav-list">
        {top.map((item) => (
          <li key={item.label}>
            <a className="side-nav-link" href={item.href} aria-current={item.current ? "page" : undefined}>
              <i className={`fa-solid ${item.icon}`} aria-hidden="true"></i>
              <span>{item.label}</span>
              {!!item.badge && (
                <span className="side-nav-badge" aria-label={`${item.badge} unread`}>
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>

      {user && (
        <Section id="dens" title="Your dens" collapsed={collapsed.includes("dens")} onToggle={toggle}>
          {dens === null ? null : dens.length === 0 ? (
            <li>
              <a className="side-nav-link" href="/blog?tab=dens">
                <i className="fa-solid fa-compass" aria-hidden="true"></i>
                <span>Find a den to join</span>
              </a>
            </li>
          ) : (
            dens.map((den) => (
              <li key={den.id}>
                <a
                  className="side-nav-link side-nav-den"
                  href={denHref(den.name)}
                  aria-current={currentDen === den.name.toLowerCase() ? "page" : undefined}
                >
                  <DenAvatar name={den.name} image={den.image} size={24} />
                  <span>{den.name}</span>
                  {den.myRole === "owner" && <i className="fa-solid fa-crown side-nav-role" title="You own this den" aria-label="Owner"></i>}
                  {den.myRole === "moderator" && <i className="fa-solid fa-shield-halved side-nav-role is-mod" title="You moderate this den" aria-label="Moderator"></i>}
                </a>
              </li>
            ))
          )}
        </Section>
      )}

      <Section id="wolflite" title="Wolflite" collapsed={collapsed.includes("wolflite")} onToggle={toggle}>
        <li>
          <a className="side-nav-link" href="/blog?tab=about" aria-current={onFeed("about") ? "page" : undefined}>
            <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
            <span>About Wolf</span>
          </a>
        </li>
        <li>
          <a className="side-nav-link" href="/blog?tab=help" aria-current={onFeed("help") ? "page" : undefined}>
            <i className="fa-solid fa-circle-question" aria-hidden="true"></i>
            <span>Help</span>
          </a>
        </li>
      </Section>
    </nav>
  );
}


interface SectionProps {
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}

// Uppercase heading with a chevron that shows / hides its links
function Section({ id, title, collapsed, onToggle, children }: SectionProps) {
  const listId = `side-nav-${id}`;
  return (
    <div className="side-nav-section">
      <button
        type="button"
        className="side-nav-heading"
        onClick={() => onToggle(id)}
        aria-expanded={!collapsed}
        aria-controls={listId}
      >
        <span>{title}</span>
        <i className={`fa-solid ${collapsed ? "fa-chevron-down" : "fa-chevron-up"}`} aria-hidden="true"></i>
      </button>
      {!collapsed && (
        <ul id={listId} className="side-nav-list">
          {children}
        </ul>
      )}
    </div>
  );
}
