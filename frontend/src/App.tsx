import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/shared/Layout'
import HomePage from './pages/HomePage'
import LearningPage from './pages/LearningPage'
import AboutPage from './pages/AboutPage'
import ProfilePage from './pages/ProfilePage'
import PricingPage from './pages/PricingPage'
import SupportPage from './pages/SupportPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import ClassroomLayout from './features/classroom/components/ClassroomLayout'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Marketing + app pages — with shared Header/Footer */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/learning" element={<LearningPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/pricing" element={<PricingPage />} />
          </Route>

          {/* OAuth callback — no layout */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Support redirects to /about#support */}
          <Route path="/support" element={<SupportPage />} />

          {/* Classroom — full-screen, no Header/Footer */}
          <Route path="/classroom/:sessionId" element={<ClassroomLayout />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
