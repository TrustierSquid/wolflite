import type { ReactNode } from "react";
import Avatar from "./Avatar";
import MentionText from "./MentionText";
import { useCurrentUser } from "../lib/currentUser";
import { denHref } from "../lib/dens";
import {
  clearAllNotifications,
  dismissNotification,
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
} from "../lib/notifications";
import type { AppNotification } from "../lib/notifications";
import { timeAgo } from "../lib/time";

/*
  The notification panel: removed from a den, mentioned with @username, and
  (later) direct messages.
  Wide screens: a column next to the feed (see WithNotifications).
  Narrow screens: opened from the bell in the navbar (className="is-popover").
*/
export default function NotificationsPanel({ className = "" }: { className?: string }) {
  const { notifications, unreadCount, error } = useNotifications();

  return (
    <aside className={`notif-panel ${className}`} aria-labelledby="notif-title">
      <div className="notif-header">
        <h2 id="notif-title" className="notif-title">
          <i className="fa-solid fa-bell" aria-hidden="true"></i> Notifications
          {unreadCount > 0 && (
            <span className="notif-count" aria-label={`${unreadCount} unread`}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </h2>
        {notifications && notifications.length > 0 && (
          <div className="notif-actions">
            {unreadCount > 0 && (
              <button type="button" className="link-btn notif-read-all" onClick={markAllNotificationsRead}>
                Mark all read
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm notif-clear"
              onClick={() => {
                if (window.confirm("Clear all notifications? This can't be undone.")) clearAllNotifications();
              }}
            >
              <i className="fa-solid fa-trash-can" aria-hidden="true"></i> Clear
            </button>
          </div>
        )}
      </div>

      <div className="notif-body">
        {notifications === null ? (
          error ? (
            <p className="notif-empty">{error}</p>
          ) : (
            <span className="loader" role="status" aria-label="Loading notifications"></span>
          )
        ) : notifications.length === 0 ? (
          <div className="notif-empty">
            <i className="fa-regular fa-bell-slash" aria-hidden="true"></i>
            <p>No notifications yet.</p>
            <p className="notif-empty-hint">You'll see mentions and den updates here.</p>
          </div>
        ) : (
          <ul className="notif-list">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}


// What a notification says, and where clicking it goes
function describe(n: AppNotification): { text: ReactNode; href: string | null; icon: string } {
  const who = <strong>{n.actor?.username ?? "Someone"}</strong>;
  const den = n.den ? <strong>{n.den.name}</strong> : null;
  const denLink = n.den?.exists ? denHref(n.den.name) : null;

  switch (n.type) {
    case "den_removed":
      return { text: <>{who} removed you from {den ?? "a den"}</>, href: denLink, icon: "fa-user-minus" };
    case "mention": {
      const where = n.commentId ? "a comment" : n.pollId ? "a poll" : "a post";
      return { text: <>{who} mentioned you in {where}{den && <> in {den}</>}</>, href: denLink, icon: "fa-at" };
    }
    case "reply": {
      const where = n.pollId ? "poll" : "post";
      return { text: <>{who} replied to your comment{den ? <> on a {where} in {den}</> : null}</>, href: denLink, icon: "fa-reply" };
    }
    case "comment": {
      const what = n.pollId ? "poll" : "post";
      return { text: <>{who} commented on your {what}{den && <> in {den}</>}</>, href: denLink, icon: "fa-comment" };
    }
    case "dm":
      return { text: <>{who} sent you a message</>, href: null, icon: "fa-envelope" };
    default:
      return { text: <>New notification</>, href: null, icon: "fa-bell" };
  }
}


function NotificationItem({ notification }: { notification: AppNotification }) {
  const { text, href, icon } = describe(notification);

  const content = (
    <>
      <span className="notif-avatar">
        <Avatar src={notification.actor?.profilePic} size={36} />
        <span className={`notif-type notif-type-${notification.type}`} aria-hidden="true">
          <i className={`fa-solid ${icon}`}></i>
        </span>
      </span>
      <span className="notif-content">
        <span className="notif-text">{text}</span>
        {notification.snippet && <span className="notif-snippet">“<MentionText text={notification.snippet} links={false} />”</span>}
        <time className="notif-time" dateTime={new Date(notification.created).toISOString()}>
          {timeAgo(notification.created)}
        </time>
      </span>
      {!notification.isRead && <span className="notif-dot" aria-label="Unread"></span>}
    </>
  );

  const open = () => {
    markNotificationRead(notification);
  };

  return (
    <li className={`notif-item${notification.isRead ? "" : " is-unread"}`}>
      {href ? (
        <a className="notif-main" href={href} onClick={open}>
          {content}
        </a>
      ) : (
        <button type="button" className="notif-main" onClick={open}>
          {content}
        </button>
      )}
      <button
        type="button"
        className="icon-btn notif-dismiss"
        onClick={() => dismissNotification(notification)}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </li>
  );
}


// Puts the notification panel next to the page's content on wide screens
// (logged in users only). On narrow screens the panel is hidden here and opened
// from the bell in the navbar instead.
export function WithNotifications({ children }: { children: ReactNode }) {
  const user = useCurrentUser();

  return (
    <div className={`layout${user ? " has-notifications" : ""}`}>
      {children}
      {user && <NotificationsPanel className="is-sidebar" />}
    </div>
  );
}
