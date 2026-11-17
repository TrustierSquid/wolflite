import { useCallback, useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import DenCard from "./DenCard";
import MentionText from "./MentionText";
import PostCard from "./PostCard";
import SearchBox from "./SearchBox";
import Status from "./Status";
import VotersModal from "./VotersModal";
import { api } from "../lib/api";
import type { CurrentUser } from "../lib/currentUser";
import type { Den } from "../lib/dens";
import type { FeedItem } from "../lib/feed";
import { formatDate } from "../lib/time";

type Category = "all" | "dens" | "users" | "posts";

/** A user in the search results (public fields only) */
interface UserResult {
  id: number;
  username: string;
  profilePic: string | null;
  bio: string | null;
  joined: string;
}

interface Results {
  query: string;
  dens: Den[];
  users: UserResult[];
  posts: FeedItem[];
}

// Wait this long after the last keystroke before searching
const DEBOUNCE_MS = 250;

// The search box text is kept in the URL (/blog?tab=search&q=...) so refreshing
// or sharing the link shows the same search
function setQueryInUrl(query: string) {
  const params = new URLSearchParams({ tab: "search" });
  if (query.trim()) params.set("q", query.trim());
  window.history.replaceState(null, "", `/blog?${params}`);
}

/*
  Search tab on the feed page: one box that searches dens (name, description),
  users (username, bio) and posts / polls (title, body, poll question and
  options). Results are grouped into Dens, Users and Posts, with
  All / Dens / Users / Posts to show just one group.
*/
export default function SearchTab({ currentUser }: { currentUser: CurrentUser | null | undefined }) {
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [category, setCategory] = useState<Category>("all");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ type: "error"; text: string } | null>(null);
  const [votersPoll, setVotersPoll] = useState(null);
  // Ignore answers to older searches that arrive after newer ones
  const latestRequest = useRef(0);

  const runSearch = useCallback(async (text: string) => {
    const trimmed = text.trim();
    const requestId = ++latestRequest.current;
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api(`/search?q=${encodeURIComponent(trimmed)}`);
      if (requestId !== latestRequest.current) return;
      setResults({ query: data.query, dens: data.dens ?? [], users: data.users ?? [], posts: data.posts ?? [] });
      setError(null);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError({ type: "error", text: err instanceof Error ? err.message : "Search failed" });
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setQueryInUrl(query);
    const timer = window.setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  // After a like / vote / join, refresh the results in place
  const refresh = useCallback(() => runSearch(query), [runSearch, query]);
  const closeVoters = useCallback(() => setVotersPoll(null), []);

  function denChanged(updated: Den) {
    setResults((prev) => prev && { ...prev, dens: prev.dens.map((den) => (den.id === updated.id ? updated : den)) });
  }

  const denCount = results?.dens.length ?? 0;
  const userCount = results?.users.length ?? 0;
  const postCount = results?.posts.length ?? 0;
  const total = denCount + userCount + postCount;
  const shows = (group: Category, count: number) => (category === "all" || category === group) && count > 0;
  const showDens = shows("dens", denCount);
  const showUsers = shows("users", userCount);
  const showPosts = shows("posts", postCount);

  return (
    <section className="search-tab" aria-label="Search">
      <SearchBox value={query} onChange={setQuery} label="Search dens, users and posts" autoFocus className="search-tab-box" />

      {results && total > 0 && (
        <div className="segmented search-filter" role="group" aria-label="Show">
          {(
            [
              ["all", "All", total],
              ["dens", "Dens", denCount],
              ["users", "Users", userCount],
              ["posts", "Posts", postCount],
            ] as [Category, string, number][]
          ).map(([key, label, count]) => (
            <button key={key} type="button" aria-pressed={category === key} onClick={() => setCategory(key)}>
              {label} <span className="search-filter-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      <Status status={error} />

      {!query.trim() ? (
        <div className="empty-state search-hint">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <p>Search dens by name or description, users by name or bio, and posts and polls by what they say.</p>
        </div>
      ) : results === null || (loading && results.query !== query.trim()) ? (
        !error && <span className="loader" role="status" aria-label="Searching"></span>
      ) : total === 0 ? (
        <div className="empty-state">
          Nothing matches “{results.query}”. Try a different word.
        </div>
      ) : (
        <div className="search-results" aria-busy={loading}>
          {showDens && (
            <div className="search-group">
              <h2 className="section-title search-group-title">
                <i className="fa-solid fa-people-group" aria-hidden="true"></i> Dens
                <span className="search-group-count">{denCount}</span>
              </h2>
              <div className="den-list">
                {results.dens.map((den) => (
                  <DenCard key={den.id} den={den} onChange={denChanged} />
                ))}
              </div>
            </div>
          )}

          {showUsers && (
            <div className="search-group">
              <h2 className="section-title search-group-title">
                <i className="fa-solid fa-user" aria-hidden="true"></i> Users
                <span className="search-group-count">{userCount}</span>
              </h2>
              <div className="den-list">
                {results.users.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </div>
            </div>
          )}

          {showPosts && (
            <div className="search-group">
              <h2 className="section-title search-group-title">
                <i className="fa-solid fa-newspaper" aria-hidden="true"></i> Posts
                <span className="search-group-count">{postCount}</span>
              </h2>
              <div className="feed-list">
                {results.posts.map((item) => (
                  <PostCard
                    key={`${item.isPoll ? "poll" : "post"}-${item.id}`}
                    item={item}
                    currentUser={currentUser}
                    onChange={refresh}
                    onShowVoters={setVotersPoll}
                  />
                ))}
              </div>
            </div>
          )}

          {/* The chosen category has no results, but the other one does */}
          {!showDens && !showUsers && !showPosts && (
            <div className="empty-state">
              No {category} match “{results.query}”.{" "}
              <button type="button" className="link-btn" onClick={() => setCategory("all")}>Show all results</button>
            </div>
          )}
        </div>
      )}

      {votersPoll && <VotersModal poll={votersPoll} onClose={closeVoters} />}
    </section>
  );
}


// One user in the results: picture, name, bio, when they joined. Links to their profile.
function UserCard({ user }: { user: UserResult }) {
  return (
    <article className="card den-card user-card">
      <a href={`/profile?id=${user.id}`} className="den-card-link">
        <Avatar src={user.profilePic} size={48} />
        <div className="den-card-info">
          <h3 className="den-card-name">{user.username}</h3>
          <p className="den-card-stats">Joined {formatDate(user.joined)}</p>
          {user.bio && (
            <p className="den-card-desc">
              <MentionText text={user.bio} links={false} />
            </p>
          )}
        </div>
      </a>
    </article>
  );
}
