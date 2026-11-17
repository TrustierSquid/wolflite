import { useCallback, useEffect, useState } from "react";
import DenAvatar from "../components/DenAvatar";
import DenCard from "../components/DenCard";
import PostCard from "../components/PostCard";
import Status from "../components/Status";
import VotersModal from "../components/VotersModal";
import { api } from "../lib/api";
import { signupHref } from "../lib/auth";
import { useCurrentUser } from "../lib/currentUser";
import { denHref, listDens } from "../lib/dens";
import type { Den } from "../lib/dens";
import type { FeedItem } from "../lib/feed";

type Tab = "home" | "discover";

// How many dens Discover shows before "Show all"
const DENS_PREVIEW = 4;

// /blog          Home: posts from the dens you joined (guests get Discover)
// /blog?tab=discover   Discover: every den and the latest posts from all of them
export default function FeedPage() {
  const currentUser = useCurrentUser(); // undefined while loading, null for guests
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  const [chosenTab, setChosenTab] = useState<Tab | null>(
    requestedTab === "discover" || requestedTab === "home" ? requestedTab : null
  );

  // Guests can only see Discover
  const tab: Tab | null = currentUser === undefined ? null : currentUser === null ? "discover" : (chosenTab ?? "home");

  const [feed, setFeed] = useState<FeedItem[] | null>(null); // null while loading
  const [dens, setDens] = useState<Den[] | null>(null);
  const [error, setError] = useState<{ type: "error"; text: string } | null>(null);
  const [votersPoll, setVotersPoll] = useState(null);
  const [showAllDens, setShowAllDens] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!tab) return;
    try {
      const data = await api(`/post/fetch?feed=${tab}`);
      setFeed(data.feed ?? []);
      setError(null);
    } catch (err) {
      setError({ type: "error", text: err instanceof Error ? err.message : "Couldn't load posts" });
    }
  }, [tab]);

  const loadDens = useCallback(async () => {
    if (!tab) return;
    try {
      setDens(await listDens(tab === "home"));
    } catch (err) {
      setError({ type: "error", text: err instanceof Error ? err.message : "Couldn't load dens" });
    }
  }, [tab]);

  useEffect(() => {
    setFeed(null);
    setDens(null);
    loadFeed();
    loadDens();
  }, [loadFeed, loadDens]);

  function switchTab(next: Tab) {
    setChosenTab(next);
    // Keep the tab in the URL so refreshing / sharing the link keeps it
    const url = next === "home" ? "/blog" : "/blog?tab=discover";
    window.history.replaceState(null, "", url);
  }

  // A join / leave changes the den list and (on Home) which posts show
  function denChanged(updated: Den) {
    setDens((prev) => prev?.map((den) => (den.id === updated.id ? updated : den)) ?? null);
    loadFeed();
  }

  const closeVoters = useCallback(() => setVotersPoll(null), []);

  if (!tab) {
    return (
      <main className="page">
        <span className="loader" role="status" aria-label="Loading"></span>
      </main>
    );
  }

  const visibleDens = dens && (showAllDens ? dens : dens.slice(0, DENS_PREVIEW));

  return (
    <main className="page">
      {currentUser && (
        <div className="tabs" role="tablist" aria-label="Feed">
          {(["home", "discover"] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === key}
              onClick={() => switchTab(key)}
            >
              <i className={`fa-solid ${key === "home" ? "fa-house" : "fa-compass"}`} aria-hidden="true"></i>{" "}
              {key === "home" ? "Home" : "Discover"}
            </button>
          ))}
        </div>
      )}

      {currentUser === null && (
        <section className="card welcome-card">
          <img src="/static/uploads/wolfLogo.png" alt="" />
          <div>
            <h1 className="welcome-title">Welcome to Wolflite</h1>
            <p className="welcome-text">
              Browse dens and see what everyone's talking about.{" "}
              <a href={signupHref()}>Create an account</a> to join dens, post and comment.
            </p>
          </div>
        </section>
      )}

      <Status status={error} />

      {tab === "home" ? (
        // Your dens as a row of chips, for quick access
        dens &&
        dens.length > 0 && (
          <nav className="den-chips" aria-label="Your dens">
            {dens.map((den) => (
              <a key={den.id} className="den-chip" href={denHref(den.name)}>
                <DenAvatar name={den.name} image={den.image} size={20} />
                {den.name}
              </a>
            ))}
            <a className="den-chip den-chip-new" href="/create?type=den">
              <i className="fa-solid fa-plus" aria-hidden="true"></i> New den
            </a>
          </nav>
        )
      ) : (
        <section className="discover-dens" aria-labelledby="dens-heading">
          <div className="section-header">
            <h2 id="dens-heading" className="section-title">Dens</h2>
            {currentUser && (
              <a className="btn btn-secondary btn-sm" href="/create?type=den">
                <i className="fa-solid fa-plus" aria-hidden="true"></i> Create a den
              </a>
            )}
          </div>

          {dens === null ? (
            !error && <span className="loader" role="status" aria-label="Loading dens"></span>
          ) : dens.length === 0 ? (
            <div className="empty-state">
              No dens yet.{" "}
              {currentUser ? <a className="link-btn" href="/create?type=den">Create the first one</a> : "Sign up to create the first one."}
            </div>
          ) : (
            <>
              <div className="den-list">
                {visibleDens!.map((den) => (
                  <DenCard key={den.id} den={den} onChange={denChanged} />
                ))}
              </div>
              {dens.length > DENS_PREVIEW && (
                <button type="button" className="link-btn show-more" onClick={() => setShowAllDens((all) => !all)}>
                  {showAllDens ? "Show fewer dens" : `Show all ${dens.length} dens`}
                </button>
              )}
            </>
          )}

          <h2 className="section-title">Latest posts</h2>
        </section>
      )}

      {feed === null ? (
        !error && <span className="loader" role="status" aria-label="Loading posts"></span>
      ) : feed.length === 0 ? (
        <EmptyFeed tab={tab} joinedAny={(dens?.length ?? 0) > 0} onDiscover={() => switchTab("discover")} />
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


function EmptyFeed({ tab, joinedAny, onDiscover }: { tab: Tab; joinedAny: boolean; onDiscover: () => void }) {
  if (tab === "discover") {
    return <div className="empty-state">No posts yet. Join a den and start the conversation.</div>;
  }

  if (!joinedAny) {
    return (
      <div className="empty-state">
        <i className="fa-solid fa-compass" aria-hidden="true"></i> You haven't joined any dens yet.{" "}
        <button type="button" className="link-btn" onClick={onDiscover}>Discover dens</button>
      </div>
    );
  }

  return (
    <div className="empty-state">
      No posts in your dens yet. <a className="link-btn" href="/create">Create the first one</a>
    </div>
  );
}
