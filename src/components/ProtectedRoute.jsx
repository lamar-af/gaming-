// Only lets signed-in users with an allowed role see the page.
// This is for navigation only. Real security is in Firestore Security Rules.
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import StateMessage from './StateMessage.jsx'

export default function ProtectedRoute({ roles }) {
  const { user, role, loading, error } = useAuth()
  const location = useLocation()

  if (!user && !loading) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (error) {
    return (
      <StateMessage type="error" title="Could not load your account.">
        Please refresh the page or log out and sign in again.
      </StateMessage>
    )
  }
  if (loading || !role) {
    return <StateMessage type="loading" title="Loading your account…" />
  }
  if (roles && !roles.includes(role)) {
    // Wrong role: send them to their own home page.
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
