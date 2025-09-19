import { useState, useRef } from "react";

export default function LikeAndComment(props){
  const [animateIndex, setAnimateIndex] = useState(null);
  const buttonRefs = useRef([]);

  async function addCommentToPost() {
    // const response = await fetch('/addCommentToPost', {

    // })
  }


  return (
    <section className="postInformation">
      {/* Likes and Comments */}
      <div className="postFunctions">
        <button
          className={`postFunctionBtn ${props?.postInformation?.likesByPost?.some(like => like.author_id === props?.currentLoggedInUserId) ? "heartIcon" : "emptyHeartIcon"}${animateIndex === props?.postIndex ? " animate__animated animate__jello" : ""}`}
          ref={(el) => (buttonRefs.current[props?.postIndex] = el)}
          onClick={() => {
            props.addLikeToPost(props?.currentLoggedInUserId, props?.postID, props?.postIndex);
            setAnimateIndex(props.postIndex)
            setTimeout(() => {
              setAnimateIndex(null)
            }, 600);
          }}
          id="likeBtn"
        >
          <i className="fa-solid fa-heart-circle-plus" ></i>
          {props?.postInformation?.likeCount}
        </button>
        <button
          className="postFunctionBtn"
          ref={(el)=> (buttonRefs.current[props?.postIndex] = el)}
          onClick={()=> {
            addCommentToPost()
          }}
        >
          <i className="fa-solid fa-message"></i>
          0
        </button>
      </div>
    </section>
  )
}