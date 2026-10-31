import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { friendlyAuthError } from '../lib/authErrors.js'
import StateMessage from '../components/StateMessage.jsx'

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

  function switchMode() {
    setMode(isSignUp ? 'signin' : 'signup')
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
    <main className="page page-narrow">
      <p className="eyebrow">// game venue booking</p>
      <h1>{isSignUp ? 'Create account' : 'Sign in'}</h1>

      <form className="card form" onSubmit={handleSubmit} noValidate>
        {isSignUp && (
          <label className="field">
            <span>Name</span>
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
            minLength={6}
            required
          />
        </label>

        {error && <StateMessage type="error">{error}</StateMessage>}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="muted">
        {isSignUp ? 'Already have an account?' : 'New here?'}{' '}
        <button type="button" className="link-button" onClick={switchMode}>
          {isSignUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </main>
  )
}
