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
import { EDIT_LOCK_HOURS } from '../config.js'

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
      <div className="booking-head">
        <strong>{booking.gameName}</strong>
        <span className={`tag status-${booking.status}`}>{statusLabel(booking)}</span>
      </div>
      <div className="booking-meta">
        <span>{formatDate(booking.start)}</span>
        <span>{formatTimeRange(booking.start, booking.end)}</span>
        <span>{booking.players} player(s)</span>
      </div>

      {isConfirmed && (
        <div className="booking-actions">
          {editable ? (
            <Link to={`/my-bookings/${booking.id}/edit`} className="btn">
              Edit
            </Link>
          ) : (
            <button type="button" className="btn" disabled aria-describedby={lockedId}>
              Edit
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
            <span id={lockedId} className="muted small">
              Changes close {EDIT_LOCK_HOURS} hours before your session
            </span>
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
      <StateMessage type="empty" title="You have no bookings yet.">
        <Link to="/book">Book your first session →</Link>
      </StateMessage>
    )
  } else {
    content = (
      <>
        <section className="stack">
          <h2>Upcoming</h2>
          {renderList(upcoming, 'No upcoming bookings.')}
        </section>
        <section className="stack">
          <h2>Past</h2>
          {renderList(past, 'No past bookings.')}
        </section>
      </>
    )
  }

  return (
    <div className="stack">
      <div>
        <p className="eyebrow">// my bookings</p>
        <h1>My bookings</h1>
        <p className="muted">
          You can edit or cancel until {EDIT_LOCK_HOURS} hours before your session.
        </p>
      </div>
      {message && <StateMessage type={message.type}>{message.text}</StateMessage>}
      {content}
    </div>
  )
}
