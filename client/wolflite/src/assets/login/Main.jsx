import { useState } from 'react'

function Main() {

  async function receieveData(e){
    e.preventDefault()
    const form = e.target;
    console.log(form)
    const formData = new FormData(form)

    try {
      const response = await fetch('/formSubmission', {
        method: "POST",
        body: formData,
      })

    } catch (error) {
      console.log(error)
    }
  }


  return (
    <>
      <main id='loginContainer'>
        <h1 className='loginTitle'>Wolf Lite</h1>
        <form method="post" id='loginForm' onSubmit={receieveData}>
          <input className="textBox" type="text" name='username' placeholder='Username' required/>
          <br />
          <input className="textBox" type="password" name='password' placeholder='Password' required/>
          <div id='submitBtnGroup'>
            <button type='submit' className='submitBtn' >Create User</button>
            <button type='submit' className='submitBtn' >Login</button>
          </div>
        </form>
      </main>
    </>
  )
}

export default Main
