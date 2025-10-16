import {useState, useRef} from 'react'

export default function ProfileSettings(props){
  const changeUsernameRef = useRef(null)
  const changeBioRef = useRef(null)
  const [successMessageChangeUsername, setSuccessMessageUsername] = useState(null)

  async function changeUsername(e){
    e.preventDefault()
    const formData = new FormData(changeUsernameRef.current);
    const formObj = Object.fromEntries(formData.entries());
    const newUsername = formObj.newUsername;

    if (newUsername.length < 4) {
      setSuccessMessageUsername(<><span id='carefulText'><i className="fa-solid fa-circle-exclamation"></i> Username needs to be at least 4 characters</span></>)
      return
    }


    try {
      let response = await fetch('/profileInfo/changeUsername', {
        method: 'PUT',
        headers: {'Content-type': 'application/json'},
        body: JSON.stringify(formObj)
      });

      let data = await response.json();

      e.target.reset()
      setSuccessMessageUsername(<><i className="fa-solid fa-square-check"></i> Username changed!</>)

    } catch (error) {
      console.log(error)
    }

  }


  return (
    <>
      <main id="homeContainer" className="animate__animated animate__fadeInLeft">
        <div id="settingsContainer">
          <section className="sectionContent">
            <h2 className="universalHeader">Profile Settings</h2>
            <p>Real-time Information and activites of your account</p>
            <hr />
          </section>


          <section className="sectionContent ">
            <div id="settingsPicture">
              <img
                id="settingsPfPic"
                src={
                  props.currentLoggedInUserProfilePic
                  ? `${import.meta.env.VITE_SERVER}${props?.currentLoggedInUserProfilePic}`
                  : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`
                } alt="" />
              <span>
                <h3>{props.currentLoggedInUsername}</h3>
                <p style={{color: "grey"}}>Profile Picture</p>
              </span>
            </div>

            <div className="settingsFunctionBtns">
              <button className="settingsBtn"><i className="fa-solid fa-image"></i> Upload New Picture</button>
              <button className="settingsDeletePfPic"><i className="fa-solid fa-trash"></i> Delete</button>
            </div>
          </section>

          <form className="sectionContent" onSubmit={changeUsername} ref={changeUsernameRef}>
            <h2 className="universalHeader">User Information</h2>
            <hr />
            <br />
            <label htmlFor=""><b>Change Username</b></label>
            <input type="Text" id="changeUsernameInput" maxLength={25} onFocus={() => setSuccessMessageUsername('')} name="newUsername" placeholder='New Username' />

            <div className="settingsFunctionBtns">
              <button type="submit" className="settingsBtn"><i className="fa-solid fa-address-card"></i> Change Username</button>
              <p className='successMessage'>{successMessageChangeUsername}</p>
            </div>
          </form>

          <section className="sectionContent" ref={changeBioRef}>
            <label htmlFor=""><b>Change Bio</b></label>
            <div id="bioDisplay">
              Lorem ipsum dolor sit amet consectetur, adipisicing elit. Odio, adipisci laboriosam illum accusantium reiciendis saepe ducimus beatae maxime quasi fuga.
            </div>

            <div className="settingsFunctionBtns">
                <button className="settingsBtn"><i className="fa-solid fa-square-pen"></i> Change Bio</button>
            </div>
          </section>

          <section className="sectionContent">
            <h2 className="universalHeader" style={{color: "red"}}>Delete Account</h2>
            <hr />
            <br />
            <div className="settingsFunctionBtns">
              <button id="deleteAccountBtn"><i className="fa-solid fa-eraser"></i> Delete Your Account</button>
              <button className="settingsBtn" onClick={()=> window.location.href = '/login'}><i className="fa-solid fa-right-from-bracket"></i> Log Out</button>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}