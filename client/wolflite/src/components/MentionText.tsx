import type { ReactNode } from "react";
import { useCurrentUser } from "../lib/currentUser";

// Same rule as the server (routes/notifications.py): "@" + username characters,
// not preceded by a word character or "@" (so emails like sam@example.com don't count)
const MENTION_RE = /(?<![\w@])@([A-Za-z0-9._-]{1,30})/g;

interface MentionTextProps {
  text: string;
  /**
   * Make each mention a link to the person's profile. Turn off when the text is
   * already inside a link (e.g. a notification), since links can't be nested.
   */
  links?: boolean;
}

/*
  Shows user-written text with @mentions highlighted in the primary color.
  Mentions of the logged in user get a soft background as well, so you can
  spot where you were mentioned.
*/
export default function MentionText({ text, links = true }: MentionTextProps) {
  const currentUser = useCurrentUser();
  const me = currentUser?.username.toLowerCase();

  const parts: ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(MENTION_RE)) {
    // "@carol.dev." at the end of a sentence: the final dots aren't part of the name
    const raw = match[1];
    const name = raw.replace(/\.+$/, "") || raw;
    const start = match.index;
    const end = start + 1 + name.length;

    if (start > last) parts.push(text.slice(last, start));

    const className = `mention${name.toLowerCase() === me ? " mention-me" : ""}`;
    parts.push(
      links ? (
        <a key={start} className={className} href={`/profile?username=${encodeURIComponent(name)}`}>
          @{name}
        </a>
      ) : (
        <span key={start} className={className}>
          @{name}
        </span>
      )
    );
    last = end;
  }

  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
