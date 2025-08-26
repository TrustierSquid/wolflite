import { useState, useEffect } from "react";


export default function BlogFeed() {
  const [allPosts, setAllPosts] = useState(null)

  useEffect(() => {
    async function fetchAllPosts(){
      try {
        const response = await fetch('/post/fetch', {
          method: 'GET',
          headers: {"Content-Type": "application/json"}
        })

        if (!response.ok) {
          throw new Error(`HTTP error! ${response.status}`)
        }

        const data = await response.json()
        setAllPosts(data)
      } catch(err) {
        console.log(err)
      }
    }

    fetchAllPosts()
  }, [])


  return (
    <main id="blogFeedContainer">
      {
        allPosts?.posts.map((post) => {
          const date = new Date(post.created)
          const today = new Date()

          const formattedDate = date.toLocaleString("en-US", {
            // weekday: "long",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: true,
            year: "numeric"
          })


          function timeAgo() {
            const diffMs = today - date; // difference in milliseconds
            const diffSec = Math.floor(diffMs/ 1000)
            const diffMin = Math.floor(diffSec/ 60)
            const diffHr = Math.floor(diffMin / 60)
            const diffDay = Math.floor(diffHr / 24)

            if (diffSec < 60) return `${diffSec}s ago`;
            if (diffMin < 60) return `${diffMin}m ago`;
            if (diffHr < 24) return `${diffHr}h ago`;
            if (diffDay < 7) return `${diffDay}d ago`;

            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            });

          }


          return (
            <>
              <section className="postContainer" key={post.id}>
                <h5 className="postAuthor">{post.username} <span>posted {timeAgo()}</span></h5>
                <h3>{post.title}</h3>
                <p>{post.body}</p>
              </section>
            </>
          )

        }).reverse()
      }

      <section className="postContainer">
        <span className="postAuthor">person</span>
        <h3>Lorem ipsum dolor sit amet.</h3>
        <p>Lorem ipsum dolor sit amet consectetur, adipisicing elit. Eaque iste blanditiis nisi provident officiis recusandae magnam ipsum odit quos omnis laboriosam natus nam aperiam, dignissimos nobis harum quidem dolore distinctio minus soluta, eligendi ut commodi architecto accusantium? Optio, possimus esse cumque, cum blanditiis earum accusantium tempora illum beatae quam hic.</p>
      </section>
      <section className="postContainer">
        <span className="postAuthor">person</span>
        <h3>Lorem ipsum dolor sit amet.</h3>
        <p>Lorem ipsum dolor sit amet consectetur, adipisicing elit. Eaque iste blanditiis nisi provident officiis recusandae magnam ipsum odit quos omnis laboriosam natus nam aperiam, dignissimos nobis harum quidem dolore distinctio minus soluta, eligendi ut commodi architecto accusantium? Optio, possimus esse cumque, cum blanditiis earum accusantium tempora illum beatae quam hic.</p>
      </section>

    </main>
  );
}
