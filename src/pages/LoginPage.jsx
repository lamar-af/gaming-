import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { friendlyAuthError } from '../lib/authErrors.js'
import StateMessage from '../components/StateMessage.jsx'
import Mascot from '../components/Mascot.jsx'

export default function LoginPage() {
  const { user, loading, logIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // After login, go back to the page they wanted, or "/" which picks the right home page.
  const goTo = location.state?.from || '/'

  // Already signed in (and not in the middle of submitting this form): skip the login page.
  if (user && !loading && !submitting) {
    return <Navigate to={goTo} replace />
  }

  const isSignUp = mode === 'signup'

  function chooseMode(newMode) {
    setMode(newMode)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (isSignUp && name.trim() === '') {
      setError('Please enter your name.')
      return
    }

    setSubmitting(true)
    try {
      if (isSignUp) await signUp(name.trim(), email.trim(), password)
      else await logIn(email.trim(), password)
      navigate(goTo, { replace: true })
    } catch (err) {
      setError(friendlyAuthError(err))
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <span className="bubble" style={{ width: 18, height: 18, left: '12%', bottom: 0 }} />
          <span className="bubble" style={{ width: 10, height: 10, left: '30%', bottom: 10 }} />
          <span className="bubble" style={{ width: 24, height: 24, left: '55%', bottom: 0 }} />
          <span className="bubble" style={{ width: 12, height: 12, left: '75%', bottom: 20 }} />
          <Mascot size={300} waving className="mascot-big" />
        </div>
        <h1 style={{ marginTop: 16 }}>Dive in and book your next game</h1>
        <p>Three games, one hour each, up to seven friends. Bloop will save you a spot.</p>
      </section>

      <form className="card form" onSubmit={handleSubmit} noValidate>
        <div className="tabs" role="tablist" aria-label="Account">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            onClick={() => chooseMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            onClick={() => chooseMode('signup')}
          >
            Create account
          </button>
        </div>
        <h2 className="sr-only">{isSignUp ? 'Create account' : 'Sign in'}</h2>

        {isSignUp && (
          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="name@example.com"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>

        {error && <StateMessage type="error">{error}</StateMessage>}

        <button type="submit" className="btn btn-primary btn-big" disabled={submitting}>
          {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
