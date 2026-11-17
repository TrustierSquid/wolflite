import { useEffect, useState } from "react";
import DenCard from "./DenCard";
import SearchBox from "./SearchBox";
import Status from "./Status";
import type { CurrentUser } from "../lib/currentUser";
import { listDens, pluralize } from "../lib/dens";
import type { Den } from "../lib/dens";
import { matchesSearch } from "../lib/search";

/*
  "Explore dens" (/blog?tab=dens): every den, biggest first, with a search box
  that filters by name and description as you type.
*/
export default function DenDirectory({ currentUser }: { currentUser: CurrentUser | null | undefined }) {
  const [dens, setDens] = useState<Den[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<{ type: "error"; text: string } | null>(null);

  useEffect(() => {
    listDens()
      .then(setDens)
      .catch((err) => setError({ type: "error", text: err instanceof Error ? err.message : "Couldn't load dens" }));
  }, []);

  const shown = dens?.filter((den) => matchesSearch(den.name, query) || matchesSearch(den.description, query)) ?? null;
  const denChanged = (updated: Den) => setDens((prev) => prev?.map((den) => (den.id === updated.id ? updated : den)) ?? null);

  return (
    <section className="den-directory" aria-labelledby="explore-title">
      <div className="section-header">
        <div>
          <h1 id="explore-title" className="page-title">Explore dens</h1>
          <p className="section-desc">
            {dens === null
              ? "Find communities to join."
              : query.trim()
                ? `${shown!.length} of ${pluralize(dens.length, "den")}`
                : `${pluralize(dens.length, "den")}, biggest first`}
          </p>
        </div>
        {currentUser && (
          <a className="btn btn-primary btn-sm" href="/create?type=den">
            <i className="fa-solid fa-plus" aria-hidden="true"></i> Create a den
          </a>
        )}
      </div>

      <SearchBox value={query} onChange={setQuery} label="Search dens by name or description" autoFocus />

      <Status status={error} />

      {shown === null ? (
        !error && <span className="loader" role="status" aria-label="Loading dens"></span>
      ) : dens!.length === 0 ? (
        <div className="empty-state">
          No dens yet.{" "}
          {currentUser ? <a className="link-btn" href="/create?type=den">Create the first one</a> : "Sign up to create the first one."}
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          No dens match “{query.trim()}”.{" "}
          {currentUser && <a className="link-btn" href="/create?type=den">Create it?</a>}
        </div>
      ) : (
        <div className="den-list">
          {shown.map((den) => (
            <DenCard key={den.id} den={den} onChange={denChanged} />
          ))}
        </div>
      )}
    </section>
  );
}
