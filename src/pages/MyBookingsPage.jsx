import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import StateMessage from '../components/StateMessage.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  cancelBooking,
  canModifyBooking,
  splitUpcomingPast,
  subscribeToMyBookings,
} from '../lib/scheduling.js'
import { formatDate, formatTimeRange } from '../lib/format.js'
import { friendlyAuthError } from '../lib/authErrors.js'
import { DEFAULT_GAME_COLOR, EDIT_LOCK_HOURS, GAME_COLORS } from '../config.js'

function statusLabel(booking) {
  if (booking.status === 'cancelled') {
    return booking.cancelledBy === 'admin' ? 'Cancelled by venue' : 'Cancelled'
  }
  return 'Confirmed'
}

function BookingCard({ booking, busy, onCancel }) {
  const editable = canModifyBooking(booking)
  const isConfirmed = booking.status === 'confirmed'
  const lockedId = `locked-${booking.id}`

  return (
    <li className={`card booking booking-${booking.status}`}>
      <span
        className="game-dot"
        style={{ background: GAME_COLORS[booking.gameId] ?? DEFAULT_GAME_COLOR }}
        aria-hidden="true"
      />
      <div>
        <h3>
          {booking.gameName}{' '}
          <span className={`tag status-${booking.status}`}>{statusLabel(booking)}</span>
        </h3>
        <p className="booking-when">
          {formatDate(booking.start)} · {formatTimeRange(booking.start, booking.end)} ·{' '}
          {booking.players} player{booking.players > 1 ? 's' : ''}
        </p>
      </div>

      {isConfirmed && (
        <div className="booking-actions">
          {editable ? (
            <Link to={`/my-bookings/${booking.id}/edit`} className="btn btn-ghost">
              Change
            </Link>
          ) : (
            <button type="button" className="btn btn-ghost" disabled aria-describedby={lockedId}>
              Change
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger"
            disabled={!editable || busy}
            aria-describedby={editable ? undefined : lockedId}
            onClick={() => onCancel(booking)}
          >
            {busy ? 'Cancelling…' : 'Cancel'}
          </button>
          {!editable && (
            <p id={lockedId} className="lock">
              Changes close {EDIT_LOCK_HOURS} hours before your session
            </p>
          )}
        </div>
      )}
    </li>
  )
}

export default function MyBookingsPage() {
  const { user } = useAuth()
  const [result, setResult] = useState({ loaded: false, bookings: [], error: null })
  const [busyId, setBusyId] = useState(null)
  // The edit page sends a message here after saving.
  const location = useLocation()
  const [message, setMessage] = useState(() =>
    location.state?.message ? { type: 'success', text: location.state.message } : null,
  ) // { type, text }

  useEffect(() => {
    return subscribeToMyBookings(
      user.uid,
      (bookings) => setResult({ loaded: true, bookings, error: null }),
      (err) => setResult({ loaded: true, bookings: [], error: err }),
    )
  }, [user.uid])

  async function handleCancel(booking) {
    const ok = window.confirm(
      `Cancel ${booking.gameName} on ${formatDate(booking.start)} at ${formatTimeRange(booking.start, booking.end)}?`,
    )
    if (!ok) return

    setBusyId(booking.id)
    setMessage(null)
    try {
      await cancelBooking(booking.id, user.uid)
      setMessage({ type: 'success', text: 'Booking cancelled. The time is now open for others.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.code ? friendlyAuthError(err) : err.message })
    } finally {
      setBusyId(null)
    }
  }

  const { upcoming, past } = splitUpcomingPast(result.bookings)

  function renderList(bookings, emptyText) {
    if (bookings.length === 0) return <StateMessage type="empty">{emptyText}</StateMessage>
    return (
      <ul className="list">
        {bookings.map((b) => (
          <BookingCard key={b.id} booking={b} busy={busyId === b.id} onCancel={handleCancel} />
        ))}
      </ul>
    )
  }

  let content
  if (!result.loaded) {
    content = <StateMessage type="loading" title="Loading your bookings…" />
  } else if (result.error) {
    content = (
      <StateMessage type="error" title="Could not load your bookings.">
        {friendlyAuthError(result.error)}
      </StateMessage>
    )
  } else if (result.bookings.length === 0) {
    content = (
      <StateMessage type="empty" title="No games booked yet">
        <p className="muted" style={{ margin: '6px 0 16px' }}>
          Pick a game and grab a time for you and your friends.
        </p>
        <Link to="/book" className="btn btn-primary">
          Book a game
        </Link>
      </StateMessage>
    )
  } else {
    content = (
      <>
        <section className="stack" aria-labelledby="upcoming-h">
          <h2 id="upcoming-h" className="section-label">
            Coming up
          </h2>
          {renderList(upcoming, 'Nothing coming up.')}
        </section>
        <section className="stack" aria-labelledby="past-h">
          <h2 id="past-h" className="section-label">
            Past
          </h2>
          {renderList(past, 'No past bookings.')}
        </section>
      </>
    )
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>My bookings</h1>
        <p>You can change or cancel a booking until {EDIT_LOCK_HOURS} hours before it starts.</p>
      </div>
      {message && <StateMessage type={message.type}>{message.text}</StateMessage>}
      {content}
    </div>
  )
}
