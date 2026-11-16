import { useEffect, useState } from "react";
import Avatar from "./Avatar";

// Popup listing who voted for each option of a poll.
// Closes with the X button, the Escape key, or a click outside the panel.
export default function VotersModal({ poll, onClose }) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    // Stop the page behind the popup from scrolling
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const options = poll.options ?? [];
  const option = options[selected];

  // The feed sends whoVoted as { optionId: [users] }, the profile page as a flat list
  const voterDetails = Object.values(poll.whoVoted ?? {}).flat();
  const findVoter = (id) => voterDetails.find((voter) => voter.user_id === id || voter.id === id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voters-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="voters-title" className="modal-title">{poll.question}</h2>
            <p className="modal-subtitle">
              {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" autoFocus>
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="voter-options">
            {options.map((opt, index) => (
              <button
                key={opt.id}
                type="button"
                className="voter-option"
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
              >
                <span className="voter-option-text">{opt.option_text}</span>
                <span className="voter-option-count">
                  {opt.user_voted} {opt.user_voted === 1 ? "vote" : "votes"}
                </span>
              </button>
            ))}
          </div>

          <div className="voter-list">
            {option?.voters?.length > 0 ? (
              option.voters.map((voterId) => {
                const voter = findVoter(voterId);
                return (
                  <a key={voterId} className="voter" href={`/profile?id=${voterId}`}>
                    <Avatar src={voter?.profilePic} size={32} />
                    {voter?.username ?? `User ${voterId}`}
                  </a>
                );
              })
            ) : (
              <p className="voters-empty">No votes for this option yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
