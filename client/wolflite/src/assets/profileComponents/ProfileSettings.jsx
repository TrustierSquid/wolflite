

export default function ProfileSettings(props){


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
              <h4>Profile Picture</h4>
            </div>

            <div className="settingsFunctionBtns">
              <button className="settingsBtn"><i className="fa-solid fa-image"></i> Upload New Picture</button>
              <button className="settingsDeletePfPic"><i className="fa-solid fa-trash"></i> Delete</button>
            </div>
          </section>

          <section className="sectionContent">
            <h2 className="universalHeader">User Information</h2>
            <hr />
            <br />
            <label htmlFor=""><b>Change Username</b></label>
            <input type="Text" id="changeUsernameInput" maxLength={30}/>

            <div className="settingsFunctionBtns">
              <button className="settingsBtn"><i className="fa-solid fa-address-card"></i> Change Username</button>
            </div>
          </section>

          <section className="sectionContent">
            <label htmlFor="">Bio</label>
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