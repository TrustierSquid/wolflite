import {useState, useRef} from 'react'

export default function ProfileSettings(props){
  const changeUsernameRef = useRef(null)
  const changeBioRef = useRef(null)
  const changeProfilePicRef = useRef(null)
  const [successMessageChangeUsername, setSuccessMessageUsername] = useState(null)
  const [successMessageChangePicture, setSuccessMessageChangePicture] = useState(null)
  const [successMessageChangeBio, setSuccessMessageChangeBio] = useState(null)
  const [editingMode, setEditingMode] = useState(false)

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

      if (response.status === 401) {
        window.location.href = "/login"
      }


      if (!response.ok) {
        alert("Username change failed");
        console.log(response);
        return;
      }

      let data = await response.json();

      e.target.reset()
      setSuccessMessageUsername(<><i className="fa-solid fa-circle-check"></i> Username changed!</>)

    } catch (error) {
      console.log(error)
    }

  }



  async function changeProfilePicture(){
    const fileInput = changeProfilePicRef.current.querySelector('input[type="file"]')
    const file = fileInput.files[0]

    if (!file) {
      alert("No file selected");
      return;
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`/post/updateProfilePicture/${props.currentLoggedInUserId}`, {
        method: "PUT",
        body: formData,
      })

      if (response.status === 401) {
        window.location.href = "/login"
      }


      if (!response.ok) {
        alert("Upload failed");
        console.log(response);
        return;
      }

      setSuccessMessageChangePicture(<><i className="fa-solid fa-circle-check"></i> Profile Picture Changed!</>)

    } catch (error) {
      console.log(error)
    }



  }

  async function deleteProfilePicture(e){
    e.preventDefault()

    try {
      let response = await fetch(`/profileInfo/deleteProfilePic`, {
        method: "PUT",
        headers: {'Content-type': 'application/json'},
        body: JSON.stringify({currentUser: `${props.currentLoggedInUserId}`})
      })


      if (response.status === 401) {
        window.location.href = "/login"
      }

      if (!response.ok) {
        alert("Deletion failed");
        console.log(response);
        return;
      }

      setSuccessMessageChangePicture(<><i className="fa-solid fa-circle-check"></i> Profile Picture Deleted!</>)


      let data = response.json()
    } catch (error){
      console.log(error)
    }

  }


  async function changeBio(e){
    e.preventDefault()
    const formData = new FormData(changeBioRef.current);
    const formObj = Object.fromEntries(formData.entries());


    try {
      let response = await fetch(`/profileInfo/changeBio`, {
        method: "PUT",
        headers: {'Content-type': 'application/json'},
        body: JSON.stringify(
          {
            currentUser: `${props.currentLoggedInUserId}`,
            newBio: `${formObj.changeBioField}`
          }
        )
      })

      if (response.status === 401) {
        window.location.href = "/login"
      }

      if (!response.ok) {
        alert("Bio change failed");
        console.log(response);
        return;
      }


      setSuccessMessageChangeBio(<><i className="fa-solid fa-circle-check"></i> Changed Bio!</>)

    } catch (error) {
      console.log(error)
    }


    let data = response.json()

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
                <p className='successMessage'>{successMessageChangePicture}</p>
              </span>
            </div>

            <form className="settingsFunctionBtns" ref={changeProfilePicRef}>
              <input id="file" type="file" name='file' onChange={changeProfilePicture}/>
              <label htmlFor='file' className="settingsBtn"><i className="fa-solid fa-image"></i> Upload New Picture</label>
              <button className="settingsDeletePfPic" onClick={(e)=> deleteProfilePicture(e)}><i className="fa-solid fa-trash"></i> Delete</button>
            </form>
          </section>

          <form className="sectionContent" onSubmit={changeUsername} ref={changeUsernameRef}>
            <h2 className="universalHeader">User Information</h2>
            <hr />
            <br />
            <label><b>Change Username</b></label>
            <input type="Text" id="changeUsernameInput" maxLength={25} onFocus={() => setSuccessMessageUsername('')} name="newUsername" placeholder={props.currentLoggedInUsername} />

            <div className="settingsFunctionBtns">
              <button type="submit" className="settingsBtn"><i className="fa-solid fa-address-card"></i> Change Username</button>
              <p className='successMessage'>{successMessageChangeUsername}</p>
            </div>
          </form>

          <section className="sectionContent">
            <label><b>Change Bio</b></label>
            <div className={editingMode ? "hideDisplay" : "bioDisplay"}>
              {props.currentLoggedInUserBio}
            </div>

            <form ref={changeBioRef} onSubmit={changeBio}>
              <textarea name="changeBioField" maxLength={500} id="changeBioField" className={editingMode ? 'bioDisplay' : 'hideDisplay'} placeholder='Change your bio 📝'></textarea>

              <div className="settingsFunctionBtns">
                  <button className={editingMode ? "settingsBtn hideDisplay" : "settingsBtn"} id='changeBioBtn' type='button' onClick={(e) => setEditingMode(prev => !prev)}><i className="fa-solid fa-square-pen"></i> Change Bio</button>
                  <button className={editingMode ? "settingsBtn" : "settingsBtn hideDisplay"} id='saveBioButton' type="submit" onClick={(e) => {setEditingMode(prev => !prev)}}><i className="fa-solid fa-floppy-disk"></i> Save</button>
                  <p className='successMessage'>{successMessageChangeBio}</p>
              </div>
            </form>
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