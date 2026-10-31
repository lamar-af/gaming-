import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StateMessage from '../components/StateMessage.jsx'
import BookingForm from '../components/BookingForm.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { bookSlot, getGames } from '../lib/scheduling.js'
import { formatDate, formatTimeRange } from '../lib/format.js'
import { friendlyAuthError } from '../lib/authErrors.js'

export default function BookPage() {
  const { user, profile } = useAuth()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState(null) // details of the booking just made

  useEffect(() => {
    getGames()
      .then(setGames)
      .catch((err) => setError(friendlyAuthError(err)))
      .finally(() => setLoading(false))
  }, [])

  async function handleBook({ slot, players }) {
    await bookSlot({ slotId: slot.id, players, user, profile })
    setBooked({ slot, players })
  }

  let content
  if (loading) {
    content = <StateMessage type="loading" title="Loading games…" />
  } else if (error) {
    content = <StateMessage type="error" title="Could not load games.">{error}</StateMessage>
  } else if (games.length === 0) {
    content = (
      <StateMessage type="empty" title="No games available yet.">
        Please check back later.
      </StateMessage>
    )
  } else if (booked) {
    content = (
      <div className="stack">
        <StateMessage type="success" title="Booking confirmed!">
          {booked.slot.gameName} · {formatDate(booked.slot.start)} ·{' '}
          {formatTimeRange(booked.slot.start, booked.slot.end)} · {booked.players} player(s)
        </StateMessage>
        <div className="row">
          <Link to="/my-bookings" className="btn btn-primary">
            View my bookings
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => setBooked(null)}>
            Book another
          </button>
        </div>
      </div>
    )
  } else {
    content = <BookingForm games={games} submitLabel="Confirm booking" onSubmit={handleBook} />
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Book a game</h1>
        <p>Each session is 60 minutes for up to 7 players.</p>
      </div>
      {content}
    </div>
  )
}
