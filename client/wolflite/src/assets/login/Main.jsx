import React from "react";
import { useState, useRef } from "react";

function Main() {
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
                <h1 className="loginText">Wolf Lite Login</h1>
              </span>
          ) : (
              <span className="loginTextContainer">
                <img src="./src/assets/imgs/wolfLogo.png" alt="Pic" />
                <h1 className="loginText">Wolf Lite</h1>
              </span>
          )
        }
        <form method="post" id="loginForm" onSubmit={receieveData}>
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
            type="password"
            name="password"
            placeholder="Password"
            required
          />

          {
            window.location.pathname == '/login' ? (
              <>
                <p id="errorMessage" className="informationText">{errorMessage}</p>
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

export default Main;
