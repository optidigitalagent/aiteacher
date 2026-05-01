import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SupportPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/about#support', { replace: true })
  }, [navigate])

  return null
}
