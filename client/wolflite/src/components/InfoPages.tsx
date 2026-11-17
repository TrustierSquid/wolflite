import type { ReactNode } from "react";
import wolfOriginal from "../assets/imgs/wolf-original.png";

// "About Wolf" and "Help" views of the feed page (/blog?tab=about, /blog?tab=help)

export function AboutWolf() {
  return (
    <section className="info-page" aria-labelledby="about-title">
      <div className="card info-hero">
        <img src="/static/uploads/wolfLogo.png" alt="" />
        <div>
          <h1 id="about-title" className="page-title">About Wolf</h1>
          <p className="section-desc">A self-hostable home for communities.</p>
        </div>
      </div>

      <div className="card info-card">
        <p>
          Wolflite is built around <strong>dens</strong>: communities for a topic, made and run by the people in them.
          Join the dens you care about and your Home feed fills up with what they're talking about. Discover shows
          everything else.
        </p>
        <p>
          It's made to be self-hosted. Developers and homelab folks can run their own Wolflite for a group of friends,
          a club or a team: one Flask server, one SQLite file, and a React front end.
        </p>
      </div>

      <div className="info-grid">
        <Feature icon="fa-people-group" title="Dens">Create a den, give it a picture and description, and pick moderators to help run it.</Feature>
        <Feature icon="fa-square-poll-horizontal" title="Posts and polls">Share text, photos and videos, or ask a question with a poll.</Feature>
        <Feature icon="fa-at" title="Mentions">Type @username to bring someone into the conversation. They get notified.</Feature>
        <Feature icon="fa-bookmark" title="Stash">Bookmark posts to come back to them later, from your profile.</Feature>
      </div>

      <DevSection />
    </section>
  );
}


// What Wolflite is built with, grouped for the "From the developer" section
const STACK: { group: string; icon: string; items: string[] }[] = [
  { group: "Frontend", icon: "fa-display", items: ["React", "TypeScript", "Vite", "Font Awesome"] },
  { group: "Backend", icon: "fa-server", items: ["Python", "Flask", "SQLite", "Gunicorn"] },
  { group: "Shipping", icon: "fa-rocket", items: ["Docker Compose", "GitHub Actions", "Tailscale", "Cloudflare Tunnel"] },
];

function DevSection() {
  return (
    <section className="card dev-section" aria-labelledby="dev-title">
      <div className="dev-header">
        <h2 id="dev-title" className="section-title">From the developer</h2>
        <p className="section-desc">How Wolflite came to be</p>
      </div>

      <div className="dev-story">
        <p>
          Wolflite has been about a <strong>year and a half</strong> in the making. It didn't start out as Wolflite:
          the first build was just called <strong>Wolf</strong>.
        </p>
        <p>
          University taught me the fundamentals of programming, but most of what went into Wolflite I learned on my
          own, through <strong>trial and error</strong>. Building something, breaking it, figuring out why, and
          building it again, one problem at a time.
        </p>
        <p>
          Most of that time went into learning what goes into a good product, not just getting features to work.
          Understanding a proper design language, building other projects along the way, and learning the attention to
          detail that UI really takes are what turned Wolf into what you're using now.
        </p>
      </div>

      <figure className="dev-figure">
        <img src={wolfOriginal} alt="The first version, Wolf: a dark red top bar, a Dashboard sidebar with topics, and a big glowing “What's New” heading above the posts" loading="lazy" />
        <figcaption>
          <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Where it started: the original <strong>Wolf</strong>
        </figcaption>
      </figure>

      <div className="dev-stack">
        <h3 className="dev-stack-title">Built with</h3>
        {STACK.map((group) => (
          <div key={group.group} className="dev-stack-group">
            <span className="dev-stack-label">
              <i className={`fa-solid ${group.icon}`} aria-hidden="true"></i> {group.group}
            </span>
            <ul className="dev-stack-items">
              {group.items.map((item) => (
                <li key={item} className="tag">{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="dev-signoff">Samuel, developer of Wolflite</p>
    </section>
  );
}

function Feature({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="card info-feature">
      <i className={`fa-solid ${icon}`} aria-hidden="true"></i>
      <h2 className="section-title">{title}</h2>
      <p>{children}</p>
    </div>
  );
}


const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "What is a den?",
    a: <>A den is a community for one topic. Every post and poll lives in a den. Find them in <a href="/blog?tab=dens">Explore dens</a>.</>,
  },
  {
    q: "How do I join a den?",
    a: <>Open the den and press <strong>Join</strong>. Its posts then show up in your Home feed. Press <strong>Joined</strong> to leave again.</>,
  },
  {
    q: "How do I post?",
    a: <>Use <strong>Create</strong> in the top bar and pick one of the dens you've joined. You can post text with a photo or video, or create a poll.</>,
  },
  {
    q: "How do I create my own den?",
    a: <>Use <a href="/create?type=den">Create a den</a>. Pick a name (it's also the den's link), write a description and optionally add a picture. You become its owner.</>,
  },
  {
    q: "How do I mention someone?",
    a: <>Type <strong>@</strong> followed by their username in a post, poll or comment. They get a notification, and the mention is highlighted.</>,
  },
  {
    q: "What do I get notified about?",
    a: <>When someone mentions you, replies to your comment, comments on your post, or removes you from a den. Notifications show in the panel on the right (or under the bell on smaller screens).</>,
  },
  {
    q: "What is stashing?",
    a: <>Stashing bookmarks a post or poll for you. It doesn't change anything for anyone else. Your stash is on your profile, under <strong>Stashed</strong>.</>,
  },
  {
    q: "Who can delete posts and comments?",
    a: <>You can delete your own. Den owners and moderators can delete anything in their den, and post authors can delete comments on their posts.</>,
  },
  {
    q: "How do moderators work?",
    a: <>A den's owner can make members moderators from the members list (click the member count on the den's page). Moderators can remove members and delete posts and comments in that den.</>,
  },
  {
    q: "How do I change the theme or accent color?",
    a: <>Go to <a href="/settings">Settings</a>, then Appearance. Your choice is saved to your account.</>,
  },
];

export function HelpPage() {
  return (
    <section className="info-page" aria-labelledby="help-title">
      <div className="card info-hero">
        <i className="fa-solid fa-circle-question info-hero-icon" aria-hidden="true"></i>
        <div>
          <h1 id="help-title" className="page-title">Help</h1>
          <p className="section-desc">Answers to common questions about Wolflite.</p>
        </div>
      </div>

      <div className="card faq">
        {FAQ.map((item) => (
          <details key={item.q} className="faq-item">
            <summary>
              <span>{item.q}</span>
              <i className="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
