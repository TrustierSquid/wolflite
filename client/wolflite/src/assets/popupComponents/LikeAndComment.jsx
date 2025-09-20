import { useState, useRef } from "react";

export default function LikeAndComment(props){
  const [animateIndex, setAnimateIndex] = useState(null);
  const [commentAnimationIndex, setCommentAnimationIndex] = useState(null)
  const buttonRefs = useRef([]);
  const [openComments, setOpenComments] = useState({});



  // OPENING COMMENT SECTIONS
  function openAndCloseCommentSection(postIndex) {
    setCommentAnimationIndex(postIndex)
    const commentSection = props.commentSectionRef?.current[postIndex];
    const isOpen = openComments[postIndex] || false;

    if (commentSection) {
      commentSection.style.display = !isOpen ? 'flex' : 'none';
      commentSection.scrollIntoView({ behavior: "smooth", block: "center" })
      setOpenComments(prev => ({
        ...prev,
        [postIndex]: !isOpen
      }));
    }
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
          className={`postFunctionBtn ${commentAnimationIndex === props?.postIndex ? " animate__animated animate__rubberBand" : ""}`}
          ref={(el)=> (buttonRefs.current[props?.postIndex] = el)}
          onClick={()=> {
            openAndCloseCommentSection(props?.postIndex)
            setTimeout(() => {
              setCommentAnimationIndex(null)
            }, 600);
          }}
        >
          <i className="fa-solid fa-message"></i>
          {props?.postInformation?.comments?.length}
        </button>
      </div>
    </section>
  )
}