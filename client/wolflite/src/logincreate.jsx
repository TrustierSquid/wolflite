import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LoginCreate from './assets/login/LoginCreate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoginCreate />
  </StrictMode>,
)
