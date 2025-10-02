import { useEffect, useState } from "react"

export default function PopupInformation(props){
  const [displayOptionVoters, setDisplayOptionVoters] = useState(0)


  // Flatten whoVoted into a single array of voter names
  const whoVotedFlat = props?.pollInfo?.whoVoted
    ? Object.values(props.pollInfo.whoVoted).flat()
    : [];

  if (!props.isOpen) {
    document.body.style.overflow = "auto";
  } else {
    document.body.style.overflow = "hidden";
  }


  return (
    <>
      <span className={props.isOpen ? "blackScreen" : "closePostInformationMoodle"} onClick={props.onClose}></span>
      <div id="moodleContainer" className={props.isOpen ? `` : `closePostInformationMoodle`} >
        <section className={props.isOpen ? "openPostInformationMoodle animate__animated animate__fadeInLeftBig  animate__faster" : "closePostInformationMoodle" }>

          <section id="moodleTitle">
            <div id="pollQuestionContainer">
              <h3 id="pollQuestion">{props?.pollInfo?.question}</h3>
              <h3 id="totalVotesCount">{props?.pollInfo?.totalVotes} Votes <i className="fa-solid fa-check-to-slot"></i></h3>
            </div>

            <button id="moodleBackButton" onClick={props.onClose}><i className="fa-solid fa-xmark"></i></button>
          </section>

          <section id="pollInformationContainer">
            <div id="listOfVotes">
              {
                props?.pollInfo?.options?.map((option, index)=> {
                  return (
                    <>
                      <div className="voteItem" onClick={() => setDisplayOptionVoters(index)}>
                        <h4
                          key={index}
                          className={`selectOption${displayOptionVoters === index ? ' selected' : ''}`}
                        >
                          {`${option.option_text} `}
                        </h4>
                        <h5 className="optionVotes">{option.user_voted} Votes <i className="fa-solid fa-check-to-slot"></i></h5>
                      </div>
                    </>
                  )
                })
              }
            </div>
            <div id="votersContainer">
              {
                props?.pollInfo?.options &&
                props?.pollInfo?.options[displayOptionVoters]?.voters?.length > 0 ? (
                  props.pollInfo.options[displayOptionVoters].voters.map((voter, idx) => {
                      const voterInfo = whoVotedFlat.find(who => (who.user_id === voter || who.id === voter));

                      return (
                        <span key={idx} className="voter">
                          <img src={voterInfo && voterInfo.profilePic ? `${import.meta.env.VITE_SERVER}${voterInfo.profilePic}` : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`} alt="" />
                          <p>
                            {voterInfo ? `${voterInfo.username} ` : voter}
                          </p>
                        </span>
                      );

                  })
                ) : (
                  <span>No voters for this option.</span>
                )
              }
            </div>
          </section>
        </section>
      </div>
    </>
  )
}