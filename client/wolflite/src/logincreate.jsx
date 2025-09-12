import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/stylesheets/loginCreateStyle.css'
import './assets/stylesheets/index.css'
import './assets/stylesheets/sideNav.css'
import LoginCreate from './assets/loginComponents/LoginCreate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoginCreate />
  </StrictMode>,
)
