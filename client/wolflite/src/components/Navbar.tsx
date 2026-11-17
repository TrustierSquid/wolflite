import type { ReactNode } from "react";
import Avatar from "./Avatar";
import { useCurrentUser } from "../lib/currentUser";
import { logout } from "../lib/logout";

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
}

const faIcon = (name: string) => <i className={`fa-solid ${name}`} aria-hidden="true"></i>;

// Top bar: logo on the left, labelled links in the center.
export default function Navbar() {
  const user = useCurrentUser();
  const path = window.location.pathname;
  const viewedProfileId = new URLSearchParams(window.location.search).get("id");

  // Highlight "Profile" on your own profile and on settings, not on other people's profiles
  const onOwnProfile =
    path === "/settings" ||
    (path === "/profile" && (!viewedProfileId || String(user?.id) === viewedProfileId));

  // Profile first; CSS adds a gap between it and the rest
  const items: NavItem[] = [
    {
      // Your picture and username (default picture / "Profile" while loading)
      label: user?.username ?? "Profile",
      ariaLabel: user ? `${user.username}, Profile` : "Profile",
      icon: (
        <span className="nav-avatar">
          <Avatar src={user?.profilePic} size={26} />
        </span>
      ),
      href: user ? `/profile?id=${user.id}` : "/profile",
      current: onOwnProfile,
    },
    { label: "Home", icon: faIcon("fa-house"), href: "/blog", current: path === "/blog" },
    { label: "Create", icon: faIcon("fa-square-plus"), href: "/create", current: path === "/create" },
    { label: "Log out", icon: faIcon("fa-right-from-bracket"), onClick: logout },
  ];

  return (
    <header className="nav">
      <a href="/blog" className="nav-logo" aria-label="Wolflite home">
        <img src="/static/uploads/wolfLogo.png" alt="" /> WOLF
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
              <li key={item.href ?? item.label}>
                {item.href ? (
                  <a {...shared} href={item.href} aria-current={item.current ? "page" : undefined}>
                    {content}
                  </a>
                ) : (
                  <button {...shared} type="button" onClick={item.onClick}>
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
