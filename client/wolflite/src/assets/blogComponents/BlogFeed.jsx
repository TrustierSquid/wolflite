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
          const formattedDate = date.toLocaleString("en-US", {
            // weekday: "long",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: true,
            year: "numeric"
          })

          return (
            <>
              <section className="postContainer">
                <h5 className="postAuthor">{post.username} <span>{formattedDate}</span></h5>
                <h2>{post.title}</h2>
                <p>{post.body}</p>
              </section>
            </>
          )
        })
      }

      <section className="postContainer">
        <span className="postAuthor">person</span>
        <h2>Lorem ipsum dolor sit amet.</h2>
        <p>Lorem ipsum dolor sit amet consectetur, adipisicing elit. Eaque iste blanditiis nisi provident officiis recusandae magnam ipsum odit quos omnis laboriosam natus nam aperiam, dignissimos nobis harum quidem dolore distinctio minus soluta, eligendi ut commodi architecto accusantium? Optio, possimus esse cumque, cum blanditiis earum accusantium tempora illum beatae quam hic.</p>
      </section>

    </main>
  );
}
