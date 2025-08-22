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
          return (
            <>
              <section className="postContainer">
                <span className="postAuthor">{post.username}</span>
                <h1>{post.title}</h1>
                <p>{post.body}</p>
              </section>
            </>
          )
        })
      }

    </main>
  );
}
