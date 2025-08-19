import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/stylesheets/loginCreateStyle.css'
import './assets/stylesheets/index.css'
import LoginCreate from './assets/login/LoginCreate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoginCreate />
  </StrictMode>,
)
