import Avatar from "./Avatar";
import { useCurrentUser } from "../lib/currentUser";
import { logout } from "../lib/logout";

interface NavLink {
  label: string;
  href: string;
  current: boolean;
  /** Font Awesome icon class; links without one show the user's profile picture */
  icon?: string;
}

// Top bar: logo on the left, icon links in the center.
export default function Navbar() {
  const user = useCurrentUser();
  const path = window.location.pathname;
  const viewedProfileId = new URLSearchParams(window.location.search).get("id");

  // Highlight "Profile" on your own profile and on settings, not on other people's profiles
  const onOwnProfile =
    path === "/settings" ||
    (path === "/profile" && (!viewedProfileId || String(user?.id) === viewedProfileId));

  const links: NavLink[] = [
    { label: "Home", icon: "fa-house", href: "/blog", current: path === "/blog" },
    // No icon: shows your profile picture (the default picture while it loads)
    { label: "Profile", href: user ? `/profile?id=${user.id}` : "/profile", current: onOwnProfile },
    { label: "Create", icon: "fa-square-plus", href: "/create", current: path === "/create" },
  ];

  return (
    <header className="nav">
      <a href="/blog" className="nav-logo" aria-label="Wolflite home">
        <img src="/static/uploads/wolfLogo.png" alt="" /> WOLF
      </a>

      <nav aria-label="Main">
        <ul className="nav-links">
          {links.map((link) => (
            <li key={link.label}>
              <a
                className="nav-link"
                href={link.href}
                title={link.label}
                aria-label={link.label}
                aria-current={link.current ? "page" : undefined}
              >
                <span className="nav-icon">
                  {link.icon ? (
                    <i className={`fa-solid ${link.icon}`} aria-hidden="true"></i>
                  ) : (
                    <span className="nav-avatar">
                      <Avatar src={user?.profilePic} size={26} />
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
          <li>
            <button type="button" className="nav-link" title="Log out" aria-label="Log out" onClick={logout}>
              <span className="nav-icon">
                <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
}
