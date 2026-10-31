// Admin: all bookings with filters (date, game, status) and a Cancel button.
import { useEffect, useState } from 'react'
import StateMessage from './StateMessage.jsx'
import {
  adminCancelBooking,
  bookingStats,
  filterBookings,
  subscribeToAllBookings,
} from '../lib/scheduling.js'
import { formatDate, formatTimeRange } from '../lib/format.js'
import { friendlyAuthError } from '../lib/authErrors.js'
import { DEFAULT_GAME_COLOR, GAME_COLORS } from '../config.js'

const NO_FILTERS = { date: '', gameId: '', status: '' }

function statusLabel(booking) {
  if (booking.status === 'cancelled') {
    return booking.cancelledBy === 'admin' ? 'Cancelled by admin' : 'Cancelled by customer'
  }
  return 'Confirmed'
}

export default function AdminBookings({ games }) {
  const [result, setResult] = useState({ loaded: false, bookings: [], error: null })
  const [filters, setFilters] = useState({ ...NO_FILTERS, status: 'confirmed' })
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
      `Cancel ${booking.userName}'s ${booking.gameName} booking on ${formatDate(booking.start)} at ${formatTimeRange(booking.start, booking.end)}? The time will open up again.`,
    )
    if (!ok) return

    setBusyId(booking.id)
    setMessage(null)
    try {
      await adminCancelBooking(booking.id)
      setMessage({ type: 'success', text: 'Booking cancelled. The time is open again.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.code ? friendlyAuthError(err) : err.message })
    } finally {
      setBusyId(null)
    }
  }

  const visible = filterBookings(result.bookings, filters)
  const stats = bookingStats(result.bookings)

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
      <StateMessage type="empty" title="No bookings match">
        <p className="muted" style={{ margin: '6px 0 16px' }}>
          Try another day or clear the filters.
        </p>
        <button type="button" className="btn btn-ghost" onClick={() => setFilters(NO_FILTERS)}>
          Clear filters
        </button>
      </StateMessage>
    )
  } else {
    content = (
      <ul className="list">
        {visible.map((b) => (
          <li key={b.id} className={`card booking booking-${b.status}`}>
            <span
              className="game-dot"
              style={{ background: GAME_COLORS[b.gameId] ?? DEFAULT_GAME_COLOR }}
              aria-hidden="true"
            />
            <div>
              <h3>
                {b.gameName} <span className={`tag status-${b.status}`}>{statusLabel(b)}</span>
              </h3>
              <p className="booking-when">
                {formatDate(b.start)} · {formatTimeRange(b.start, b.end)} · {b.players} player
                {b.players > 1 ? 's' : ''}
              </p>
              <p className="booking-when">
                {b.userName} · <a href={`mailto:${b.userEmail}`}>{b.userEmail}</a>
              </p>
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
    <section className="stack" aria-labelledby="bookings-h">
      <h2 id="bookings-h" className="sr-only">
        Bookings
      </h2>

      {result.loaded && !result.error && (
        <div className="stats">
          <div className="stat">
            <b>{stats.upcomingSessions}</b>
            <span className="muted">upcoming sessions</span>
          </div>
          <div className="stat">
            <b>{stats.playersExpected}</b>
            <span className="muted">players expected</span>
          </div>
        </div>
      )}

      <div className="card filters">
        <label className="field">
          <span>Day</span>
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
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      <p className="small muted" aria-live="polite">
        Showing {visible.length} of {result.bookings.length} booking(s) ·{' '}
        <button type="button" className="link-button" onClick={() => setFilters(NO_FILTERS)}>
          Clear filters
        </button>
      </p>

      {message && <StateMessage type={message.type}>{message.text}</StateMessage>}
      {content}
    </section>
  )
}
