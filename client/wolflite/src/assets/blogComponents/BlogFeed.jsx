import { useState, useEffect } from "react";

export default function BlogFeed() {
  const [allPosts, setAllPosts] = useState(null);

  useEffect(() => {
    async function fetchAllPosts() {
      try {
        const response = await fetch("/post/fetch", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! ${response.status}`);
        }

        const data = await response.json();
        setAllPosts(data);
      } catch (err) {
        console.log(err);
      }
    }

    fetchAllPosts();
  }, []);

  return (
    <main id="blogFeedContainer">
      {
        // Loading condition for fetching the posts from the server
        allPosts ? (
          // Show all posts if there are any - otherwise show a 'no posts' message
          allPosts?.posts.length > 0 ? (
            allPosts?.posts
              .map((post) => {
                // Post date formatting
                const date = new Date(post.created);
                const today = new Date();

                function timeAgo() {
                  const diffMs = today - date; // difference in milliseconds
                  const diffSec = Math.floor(diffMs / 1000);
                  const diffMin = Math.floor(diffSec / 60);
                  const diffHr = Math.floor(diffMin / 60);
                  const diffDay = Math.floor(diffHr / 24);

                  if (diffSec < 60) return `${diffSec}s ago`;
                  if (diffMin < 60) return `${diffMin}m ago`;
                  if (diffHr < 24) return `${diffHr}h ago`;
                  if (diffDay < 7) return `${diffDay}d ago`;

                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                }

                return (
                  <>
                    <section
                      className="postContainer"
                      key={post.id}
                    >
                      <h5 className="postAuthor">
                        {post.username} <span>posted {timeAgo()}</span>
                      </h5>
                      <h3>{post.title}</h3>
                      <img
                        id="postImage"
                        src={`http://localhost:5000/${post.filename}`}
                        alt=""
                      />
                      <p>{post.body}</p>
                    </section>
                  </>
                );
              })
              .reverse()
          ) : (
            <span>No Posts yet!</span>
          )
        ) : (
          <span class="loader"></span>
        )
      }
    </main>
  );
}
