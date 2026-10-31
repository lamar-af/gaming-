// Admin: all bookings with filters (date, game, status) and a Cancel button.
import { useEffect, useState } from 'react'
import StateMessage from './StateMessage.jsx'
import {
  adminCancelBooking,
  filterBookings,
  subscribeToAllBookings,
} from '../lib/scheduling.js'
import { formatDate, formatTimeRange } from '../lib/format.js'
import { friendlyAuthError } from '../lib/authErrors.js'

function statusLabel(booking) {
  if (booking.status === 'cancelled') {
    return booking.cancelledBy === 'admin' ? 'Cancelled by admin' : 'Cancelled by customer'
  }
  return 'Confirmed'
}

export default function AdminBookings({ games }) {
  const [result, setResult] = useState({ loaded: false, bookings: [], error: null })
  const [filters, setFilters] = useState({ date: '', gameId: '', status: 'confirmed' })
  const [busyId, setBusyId] = useState(null)
  const [message, setMessage] = useState(null) // { type, text }

  useEffect(() => {
    return subscribeToAllBookings(
      (bookings) => setResult({ loaded: true, bookings, error: null }),
      (err) => setResult({ loaded: true, bookings: [], error: err }),
    )
  }, [])

  function setFilter(name, value) {
    setFilters((f) => ({ ...f, [name]: value }))
  }

  async function handleCancel(booking) {
    const ok = window.confirm(
      `Cancel ${booking.userName}'s booking for ${booking.gameName} on ${formatDate(booking.start)} at ${formatTimeRange(booking.start, booking.end)}?`,
    )
    if (!ok) return

    setBusyId(booking.id)
    setMessage(null)
    try {
      await adminCancelBooking(booking.id)
      setMessage({ type: 'success', text: 'Booking cancelled. The slot is open again.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.code ? friendlyAuthError(err) : err.message })
    } finally {
      setBusyId(null)
    }
  }

  const visible = filterBookings(result.bookings, filters)

  let content
  if (!result.loaded) {
    content = <StateMessage type="loading" title="Loading bookings…" />
  } else if (result.error) {
    content = (
      <StateMessage type="error" title="Could not load bookings.">
        {friendlyAuthError(result.error)}
      </StateMessage>
    )
  } else if (visible.length === 0) {
    content = (
      <StateMessage type="empty" title="No bookings match these filters.">
        {result.bookings.length > 0 && 'Try clearing a filter.'}
      </StateMessage>
    )
  } else {
    content = (
      <ul className="list">
        {visible.map((b) => (
          <li key={b.id} className={`card booking booking-${b.status}`}>
            <div className="booking-head">
              <strong>{b.gameName}</strong>
              <span className={`tag status-${b.status}`}>{statusLabel(b)}</span>
            </div>
            <div className="booking-meta">
              <span>{formatDate(b.start)}</span>
              <span>{formatTimeRange(b.start, b.end)}</span>
              <span>{b.players} player(s)</span>
            </div>
            <div className="small">
              {b.userName} · <a href={`mailto:${b.userEmail}`}>{b.userEmail}</a>
            </div>
            {b.status === 'confirmed' && (
              <div className="booking-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busyId === b.id}
                  onClick={() => handleCancel(b)}
                >
                  {busyId === b.id ? 'Cancelling…' : 'Cancel booking'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="card stack">
      <h2>Bookings</h2>

      <div className="row">
        <label className="field">
          <span>Date</span>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilter('date', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Game</span>
          <select value={filters.gameId} onChange={(e) => setFilter('gameId', e.target.value)}>
            <option value="">All games</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      <div className="row small muted">
        <span>
          Showing {visible.length} of {result.bookings.length} booking(s)
        </span>
        <button
          type="button"
          className="link-button"
          onClick={() => setFilters({ date: '', gameId: '', status: '' })}
        >
          Clear filters
        </button>
      </div>

      {message && <StateMessage type={message.type}>{message.text}</StateMessage>}
      {content}
    </section>
  )
}
