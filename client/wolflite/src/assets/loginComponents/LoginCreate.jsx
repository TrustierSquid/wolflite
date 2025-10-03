import React from "react";
import { useState, useRef } from "react";

function LoginCreate() {
  const [errorMessage, setErrorMessage] = useState('')
  const usernameRef = useRef()
  const passwordRef = useRef()
  const [revealPassword, setRevealPassword] = useState(false)



  async function createUser(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);


    try {
      const request = await fetch("/formSubmission", {
        method: "POST",
        body: formData,
      });

      // parse the response as json
      const response = await request.json();


      // usernameRef.current.value = ''



      if (Object.keys(response).includes("sanitationError")){
        setErrorMessage(response.sanitationError)
        passwordRef.current.value = ``
        passwordRef.current.value = ``
        return
      }

      if (Object.keys(response).includes("errorMessage")) {
        usernameRef.current.value = `${usernameRef.current.value}`
        passwordRef.current.value = `${passwordRef.current.value}`
        setErrorMessage('The username exists already')
        return
      } else if (Object.keys(response).includes("message")) {
        setErrorMessage('')
      }



      window.location.href = '/login'

    } catch (error) {
      console.log(error);
    }
  }


  async function loginUser(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    try {
      const request = await fetch("/loginUser", {
        method: 'POST',
        body: formData
      })

      passwordRef.current.value = ''

      const response = await request.json()

      if (Object.keys(response).includes("message")) {
        setErrorMessage(response.message)
      } else {
        setErrorMessage('')
        window.location.href = '/blog'
      }

    } catch (error) {
      console.log(error)
    }


  }

  function reveal() {
    setRevealPassword((prev)=> !prev)
  }

  return (
    <>
      <section id="loginBox">
        <main id="loginContainer" className="animate__bounceInLeft animate__animated">
          {
            // LOGIN ENDPOINT
            window.location.pathname == '/login' ? (
              <>
                <section id="loginSection1">
                  <span className="loginTextContainer" >
                    <img src={`${import.meta.env.VITE_SERVER}/static/uploads/wolfLogo.png`} alt="Pic" />
                    <p className="loginText">Login</p>
                  </span>
                  <form method="post" id="loginForm" onSubmit={loginUser}>
                    <input
                      className="textBox"
                      type="text"
                      ref={usernameRef}
                      name="username"
                      placeholder="Username"
                      required
                    />
                    <br />
                    <input
                      ref={passwordRef}
                      className="textBox"
                      type={revealPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password"
                      required
                    />

                    <div id="submitBtnGroup">
                      <input type="checkbox" onClick={()=> reveal()}/> {revealPassword ? "Hide password 🚫" : "Reveal password 👁️"}
                      <p id="errorMessage" className="informationText">{errorMessage}</p>
                      <button type="submit" className="submitBtn">
                        Login
                      </button>
                    </div>

                  </form>
                </section>
                <section id="loginSection2">
                  <h1>Welcome! 👋 </h1>
                  <h3>Create a new user and begin this journey with us!</h3>
                  <button className="submitBtn" onClick={()=> window.location.href = '/'}>Create user</button>
                </section>
              </>

            ) : (
              // CREATE USER ENDPOINT
              <>
                <section id="loginSection1">
                  <span className="loginTextContainer" >
                    <img src={`${import.meta.env.VITE_SERVER}/static/uploads/wolfLogo.png`} alt="Pic" />
                    <p className="loginText">Create User</p>
                  </span>
                  <form method="post" id="loginForm" onSubmit={createUser}>
                    <input
                      className="textBox"
                      type="text"
                      ref={usernameRef}
                      name="username"
                      placeholder="Enter a username"
                      required
                    />
                    <br />
                    <input
                      ref={passwordRef}
                      className="textBox"
                      type={revealPassword ? "text" : "password"}
                      name="password"
                      placeholder="Enter a password"
                      required
                    />

                    <div id="submitBtnGroup">
                      <input type="checkbox" onClick={()=> reveal()}/> {revealPassword ? "Hide password 🚫" : "Reveal password 👁️"}
                      <p id="errorMessage" className="informationText">{errorMessage}</p>
                      <button type="submit" className="submitBtn">
                        Create User
                      </button>
                    </div>

                  </form>
                </section>
                <section id="loginSection2">
                  <h1>Hey There! 👋 </h1>
                  <h3>Welcome back! Let’s pick up right where you left off.</h3>
                  <button className="submitBtn" onClick={()=> window.location.href = '/login'}>Login</button>
                </section>
              </>
            )
          }

        </main>
      </section>
    </>
  );
}

export default LoginCreate;
