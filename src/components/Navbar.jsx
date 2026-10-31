import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const LINKS = {
  customer: [
    { to: '/book', label: 'Book' },
    { to: '/my-bookings', label: 'My bookings' },
  ],
  admin: [{ to: '/admin', label: 'Admin' }],
}

export default function Navbar() {
  const { profile, role, logOut } = useAuth()
  const navigate = useNavigate()

  function goBack() {
    // React Router stores the history position in idx. 0 means this is the first page.
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/')
  }

  async function handleLogOut() {
    await logOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="navbar">
      <button type="button" className="btn btn-ghost" onClick={goBack}>
        ← Back
      </button>

      <nav aria-label="Main">
        {(LINKS[role] ?? []).map((link) => (
          <NavLink key={link.to} to={link.to} end className="nav-link">
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="navbar-user">
        <span className="navbar-name">
          {profile?.name} <span className="tag">{role}</span>
        </span>
        <button type="button" className="btn btn-ghost" onClick={handleLogOut}>
          Log out
        </button>
      </div>
    </header>
  )
}
