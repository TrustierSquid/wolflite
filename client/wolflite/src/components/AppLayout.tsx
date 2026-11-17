import type { ReactNode } from "react";
import NotificationsPanel from "./NotificationsPanel";
import SideNav from "./SideNav";
import { useCurrentUser } from "../lib/currentUser";

/*
  Page layout around the main content:
    wide screens (1180px+)  side nav | page | notifications   (the page stays centered)
    narrower                side nav as a row above the page; notifications open
                            from the bell in the navbar
  Notifications are for logged in users only; everyone gets the side nav.
*/
export default function AppLayout({ children }: { children: ReactNode }) {
  const user = useCurrentUser();

  return (
    <div className={`layout${user ? " has-notifications" : ""}`}>
      <SideNav />
      {children}
      {user && <NotificationsPanel className="is-sidebar" />}
    </div>
  );
}
