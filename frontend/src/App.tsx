import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LessonRoom          from './components/LessonRoom/LessonRoom'
import DemoSetup           from './components/demo/DemoSetup'
import HomePage            from './pages/HomePage'
import DemoClassroomPage   from './pages/DemoClassroomPage'
import AuthCallbackPage    from './pages/AuthCallbackPage'
import PricingPage         from './pages/PricingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                   element={<HomePage />} />
        <Route path="/lesson"             element={<LessonRoom />} />
        <Route path="/demo/setup"         element={<DemoSetup />} />
        <Route path="/demo/classroom/:id" element={<DemoClassroomPage />} />
        <Route path="/auth/callback"      element={<AuthCallbackPage />} />
        <Route path="/pricing"            element={<PricingPage />} />
      </Routes>
    </BrowserRouter>
  )
}
