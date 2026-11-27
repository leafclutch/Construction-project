import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { AuthProvider } from './auth/AuthProvider'
import { AppUpdate } from './components/AppUpdate'
import { ToastProvider } from './components/toast'
import './index.css'
// Catches the install offer before React starts.
import './lib/install'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
        <AppUpdate />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)
