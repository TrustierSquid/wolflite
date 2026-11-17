import { useCallback, useEffect, useState } from "react";
import PostCard from "../components/PostCard";
import Status from "../components/Status";
import VotersModal from "../components/VotersModal";
import { api } from "../lib/api";
import { useCurrentUser } from "../lib/currentUser";

// Home feed: every post and poll, newest first
export default function FeedPage() {
  const currentUser = useCurrentUser();
  const [feed, setFeed] = useState(null); // null while loading
  const [error, setError] = useState(null);
  const [votersPoll, setVotersPoll] = useState(null);

  const loadFeed = useCallback(async () => {
    try {
      const data = await api("/post/fetch");
      setFeed(data.feed ?? []);
      setError(null);
    } catch (err) {
      setError({ type: "error", text: err.message });
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const closeVoters = useCallback(() => setVotersPoll(null), []);

  return (
    <main className="page">
      <Status status={error} />

      {feed === null ? (
        !error && <span className="loader" role="status" aria-label="Loading posts"></span>
      ) : feed.length === 0 ? (
        <div className="empty-state">
          No posts yet. <a className="link-btn" href="/create">Create the first one</a>
        </div>
      ) : (
        <div className="feed-list">
          {feed.map((item) => (
            <PostCard
              key={`${item.isPoll ? "poll" : "post"}-${item.id}`}
              item={item}
              currentUser={currentUser}
              onChange={loadFeed}
              onShowVoters={setVotersPoll}
            />
          ))}
        </div>
      )}

      {votersPoll && <VotersModal poll={votersPoll} onClose={closeVoters} />}
    </main>
  );
}
