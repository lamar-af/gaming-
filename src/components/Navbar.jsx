import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Mascot from './Mascot.jsx'

const LINKS = {
  customer: [
    { to: '/book', label: 'Book a game' },
    { to: '/my-bookings', label: 'My bookings' },
  ],
  admin: [{ to: '/admin', label: 'All bookings' }],
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
      <div className="navbar-inner">
        <button type="button" className="btn btn-ghost" onClick={goBack} aria-label="Go back">
          ‹ Back
        </button>

        <Link to="/" className="brand">
          <Mascot size={34} />
          Bubble Quest
        </Link>

        <nav className="nav-links" aria-label="Main">
          {(LINKS[role] ?? []).map((link) => (
            <NavLink key={link.to} to={link.to} end className="nav-link">
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="navbar-user">
          <span className="small">
            {profile?.name} {role === 'admin' && <span className="tag">admin</span>}
          </span>
          <button type="button" className="btn btn-ghost" onClick={handleLogOut}>
            Log out
          </button>
        </div>
      </div>
    </header>
  )
}
