import { useState, useEffect } from "react"


export default function PopupForm(){
   const [menuSelector, setMenuSelector] = useState(null)

   function postContent(){
      console.log("post")
   }


   return (
      <>



         <main id="elementContainer">
            <h2 className="postTitle">Create Post</h2>

            <div id="createMenuContainer">
               <ul id="createMenuOptions">
                  <li onClick={()=> setMenuSelector('Text')}><h3>Text</h3></li>
                  <li onClick={()=> setMenuSelector('Image')}><h3>Image</h3></li>
                  <li onClick={()=> setMenuSelector('Poll')}><h3>Poll</h3></li>
               </ul>
               <section id="createMenuContent">
                  <h2>Text</h2><br />
                  <form action="/post/create" method="POST" id="createPostForm">
                     <div className="formPostTitleSection">
                        <label className="createPostFormLabel" for="postTitle">Post Title:</label><br />
                        <input className="createPostFormInputTitle" name="postTitle" type="text" placeholder="Enter a post title" />
                     </div>

                     <div className="formPostBodySection">
                        <label className="createPostFormLabel" for="postContent">Post Body:</label><br />
                        <textarea className="createPostFormInput" type="text" name="postContent" placeholder="Enter a post Body"/>
                     </div>
                     <button type="submit">Post</button>
                  </form>
               </section>
            </div>
         </main>


      </>
   )

}