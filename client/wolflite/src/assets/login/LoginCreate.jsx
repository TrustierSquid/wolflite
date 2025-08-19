import React from "react";
import { useState, useRef } from "react";

function LoginCreate() {
  const [errorMessage, setErrorMessage] = useState('')
  const usernameRef = useRef()
  const passwordRef = useRef()


  async function receieveData(e) {
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

      usernameRef.current.value = ''
      passwordRef.current.value = ''

      window.location.href = '/login'

      if (Object.keys(response).includes("errorMessage")) {
        setErrorMessage('The username exists already')

      } else if (Object.keys(response).includes("message")) {
        setErrorMessage('')
      }

    } catch (error) {
      console.log(error);
    }
  }

  return (
    <>
      <main id="loginContainer">
        {
          window.location.pathname == '/login' ? (
              <span className="loginTextContainer" >
                <img src="./src/assets/imgs/wolfLogo.png" alt="Pic" />
                <p className="loginText">Wolf Lite Login</p>
              </span>
          ) : (
              <span className="loginTextContainer">
                <img src="./src/assets/imgs/wolfLogo.png" alt="Pic" />
                <p className="loginText">WOLF Lite</p>
              </span>
          )
        }
        <form method="post" id="loginForm" onSubmit={receieveData}>
          <input
            className="textBox"
            type="text"
            ref={usernameRef}
            name="username"
            placeholder="Enter your username"
            required
          />
          <br />
          <input
            ref={passwordRef}
            className="textBox"
            type="password"
            name="password"
            placeholder="Enter your password"
            required
          />

          <p id="errorMessage" className="informationText">{errorMessage}</p>

          {
            window.location.pathname == '/login' ? (
              <>
                <span className="informationText">Not a user? <a href="/">Create one!</a></span>
                <div id="submitBtnGroup">
                  <button type="submit" className="submitBtn">
                    Login
                  </button>
                </div>
              </>
            ) : (
              <>
                <p id="errorMessage" className="informationText">{errorMessage}</p>
                <span className="informationText">Already a user? <a href="/login">Login</a></span>
                <div id="submitBtnGroup">
                  <button type="submit" className="submitBtn">
                    Create User
                  </button>
                </div>

              </>
            )
          }

        </form>
      </main>
    </>
  );
}

export default LoginCreate;
