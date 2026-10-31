// Admin tools: all bookings, slot blocking, seed games, generate slots.
import { useEffect, useState } from 'react'
import StateMessage from '../components/StateMessage.jsx'
import AdminBookings from '../components/AdminBookings.jsx'
import SlotManager from '../components/SlotManager.jsx'
import {
  MAX_GENERATE_DAYS,
  addDays,
  generateSlots,
  getGames,
  seedGames,
  todayAtVenue,
} from '../lib/scheduling.js'
import { friendlyAuthError } from '../lib/authErrors.js'

// Our own validation errors have no code; Firebase errors do.
function errorText(err) {
  return err?.code ? friendlyAuthError(err) : err.message
}

function GamesSection() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    getGames()
      .then(setGames)
      .catch((err) => setError(errorText(err)))
      .finally(() => setLoading(false))
  }, [])

  async function handleSeed() {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const { created, skipped } = await seedGames()
      setSuccess(`Created ${created} game(s). ${skipped} already existed.`)
      setGames(await getGames())
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack">
      <h2>Games</h2>

      {loading ? (
        <StateMessage type="loading" title="Loading games…" />
      ) : games.length === 0 ? (
        <StateMessage type="empty" title="No games yet.">
          Click “Seed games” to create the 3 default games.
        </StateMessage>
      ) : (
        <ul className="list">
          {games.map((game) => (
            <li key={game.id}>
              <strong>{game.name}</strong>{' '}
              <span className="tag">{game.id}</span>
              <div className="muted">
                {game.durationMinutes} min · up to {game.maxPlayers} players
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <StateMessage type="error">{error}</StateMessage>}
      {success && <StateMessage type="success">{success}</StateMessage>}

      <div>
        <button type="button" className="btn" onClick={handleSeed} disabled={busy}>
          {busy ? 'Seeding…' : 'Seed games'}
        </button>
      </div>
    </section>
  )
}

function GenerateSlotsSection() {
  const today = todayAtVenue()
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(addDays(today, 6))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleGenerate(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const { created, skipped } = await generateSlots(startDate, endDate)
      setSuccess(`Created ${created} slot(s). Skipped ${skipped} that already existed.`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <form className="form" onSubmit={handleGenerate}>
        <h2>Generate slots</h2>
        <p className="muted">
          Creates hourly sessions 12:00–21:00 for every game. Existing slots are never
          overwritten. Max {MAX_GENERATE_DAYS} days at a time.
        </p>

        <div className="row">
          <label className="field">
            <span>Start date</span>
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>End date</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </label>
        </div>

        {error && <StateMessage type="error">{error}</StateMessage>}
        {success && <StateMessage type="success">{success}</StateMessage>}

        <div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Generating…' : 'Generate slots'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default function AdminPage() {
  // Games are needed by the bookings filter and the slot manager.
  const [games, setGames] = useState(null)

  useEffect(() => {
    getGames()
      .then(setGames)
      .catch(() => setGames([]))
  }, [])

  return (
    <div className="stack">
      <div className="page-head">
        <h1>All bookings</h1>
        <p>See who’s coming and cancel a booking when you need to.</p>
      </div>
      {games === null ? (
        <StateMessage type="loading" title="Loading…" />
      ) : (
        <>
          <AdminBookings games={games} />
          <h2 className="section-label">Venue tools</h2>
          {games.length > 0 && <SlotManager games={games} />}
        </>
      )}
      <GamesSection />
      <GenerateSlotsSection />
    </div>
  )
}
