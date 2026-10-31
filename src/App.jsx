import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppLayout from './components/AppLayout.jsx'
import StateMessage from './components/StateMessage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import BookPage from './pages/BookPage.jsx'
import MyBookingsPage from './pages/MyBookingsPage.jsx'
import EditBookingPage from './pages/EditBookingPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

// "/" sends each user to the right place: login, booking page, or admin page.
function HomeRedirect() {
  const { user, role, loading, error } = useAuth()

  if (!user && !loading) return <Navigate to="/login" replace />
  if (error) {
    return (
      <main className="page">
        <StateMessage type="error" title="Could not load your account.">
          Please refresh the page.
        </StateMessage>
      </main>
    )
  }
  if (loading || !role) {
    return (
      <main className="page">
        <StateMessage type="loading" title="Loading your account…" />
      </main>
    )
  }
  return <Navigate to={role === 'admin' ? '/admin' : '/book'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Every page below needs a signed-in user and shows the navbar. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route element={<ProtectedRoute roles={['customer']} />}>
                <Route path="/book" element={<BookPage />} />
                <Route path="/my-bookings" element={<MyBookingsPage />} />
                <Route path="/my-bookings/:id/edit" element={<EditBookingPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
