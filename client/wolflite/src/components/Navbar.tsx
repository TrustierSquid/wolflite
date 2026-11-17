import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";
import LoginPrompt from "./LoginPrompt";
import NotificationsPanel from "./NotificationsPanel";
import { loginHref, signupHref } from "../lib/auth";
import { useCurrentUser } from "../lib/currentUser";
import { logout } from "../lib/logout";
import { useNotifications } from "../lib/notifications";

interface NavItem {
  /** Text shown next to the icon (hidden on narrow screens, still read by screen readers) */
  label: string;
  /** Icon, or the user's avatar for the profile link */
  icon: ReactNode;
  /** Where the link goes; items without one are buttons */
  href?: string;
  onClick?: () => void;
  current?: boolean;
  /** Full accessible name when it should say more than the label */
  ariaLabel?: string;
  /** Extra class on the <li> */
  className?: string;
}

const faIcon = (name: string) => <i className={`fa-solid ${name}`} aria-hidden="true"></i>;

// Top bar: logo on the left, labelled links in the center.
// Logged in: Profile, Home, Create, Log out. Guests: Home, Log in, Sign up.
export default function Navbar() {
  const user = useCurrentUser(); // undefined while loading, null for guests
  const { unreadCount } = useNotifications(!!user);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const path = window.location.pathname;

  // Escape closes the notifications sheet
  useEffect(() => {
    if (!notificationsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setNotificationsOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [notificationsOpen]);
  const viewedProfileId = new URLSearchParams(window.location.search).get("id");

  // Highlight "Profile" on your own profile and on settings, not on other people's profiles
  const onOwnProfile =
    path === "/settings" ||
    (path === "/profile" && (!viewedProfileId || String(user?.id) === viewedProfileId));

  const home: NavItem = { label: "Home", icon: faIcon("fa-house"), href: "/blog", current: path === "/blog" };

  let items: NavItem[];
  if (user) {
    items = [
      {
        // Your picture and username. CSS adds a gap between it and the rest.
        label: user.username,
        ariaLabel: `${user.username}, Profile`,
        icon: (
          <span className="nav-avatar">
            <Avatar src={user.profilePic} size={26} />
          </span>
        ),
        href: `/profile?id=${user.id}`,
        current: onOwnProfile,
        className: "nav-profile",
      },
      home,
      { label: "Create", icon: faIcon("fa-square-plus"), href: "/create", current: path === "/create" },
      {
        // Only shown on screens too narrow for the notification panel next to the feed
        label: "Notifications",
        ariaLabel: unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications",
        icon: (
          <span className="nav-bell">
            {faIcon("fa-bell")}
            {unreadCount > 0 && <span className="nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </span>
        ),
        onClick: () => setNotificationsOpen((open) => !open),
        current: notificationsOpen,
        className: "nav-notifications",
      },
      { label: "Log out", icon: faIcon("fa-right-from-bracket"), onClick: logout },
    ];
  } else if (user === null) {
    items = [
      home,
      { label: "Log in", icon: faIcon("fa-right-to-bracket"), href: loginHref() },
      { label: "Sign up", icon: faIcon("fa-user-plus"), href: signupHref(), className: "nav-signup" },
    ];
  } else {
    // Still loading: just Home, so guests don't see a flash of the logged in links
    items = [home];
  }

  return (
    <header className="nav">
      <a href="/blog" className="nav-logo" aria-label="Wolflite home">
        <img src="/static/uploads/wolfLogo.png" alt="" /> <span className="nav-logo-text">WOLF</span>
      </a>

      <nav aria-label="Main">
        <ul className="nav-links">
          {items.map((item) => {
            const content = (
              <span className="nav-icon">
                {item.icon}
                <span className="nav-label">{item.label}</span>
              </span>
            );
            const shared = {
              className: "nav-link",
              title: item.ariaLabel ?? item.label,
              "aria-label": item.ariaLabel,
            };

            return (
              <li key={item.label} className={item.className}>
                {item.href ? (
                  <a {...shared} href={item.href} aria-current={item.current ? "page" : undefined}>
                    {content}
                  </a>
                ) : (
                  <button
                    {...shared}
                    type="button"
                    onClick={item.onClick}
                    aria-expanded={item.className === "nav-notifications" ? notificationsOpen : undefined}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <LoginPrompt />

      {/* Narrow screens: notifications drop down from the bell. Rendered in <body>
          because the navbar's backdrop-filter would trap a fixed-position child. */}
      {notificationsOpen &&
        createPortal(
          <div className="notif-sheet-backdrop" onClick={() => setNotificationsOpen(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <NotificationsPanel className="is-popover" />
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
