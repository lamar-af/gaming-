// Admin: see every slot for a game/date and block or unblock open ones.
import { useEffect, useState } from 'react'
import StateMessage from './StateMessage.jsx'
import { setSlotBlocked, subscribeToSlots, todayAtVenue } from '../lib/scheduling.js'
import { formatTimeRange } from '../lib/format.js'
import { friendlyAuthError } from '../lib/authErrors.js'

export default function SlotManager({ games }) {
  const [gameId, setGameId] = useState(games[0]?.id ?? '')
  const [date, setDate] = useState(todayAtVenue())
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  // Same "keyed result" pattern as BookingForm: stale results show as loading.
  const key = `${gameId}|${date}`
  const [result, setResult] = useState({ key: null, slots: [], error: null })
  const loading = result.key !== key

  useEffect(() => {
    if (!gameId || !date) return
    const key = `${gameId}|${date}`
    return subscribeToSlots(
      gameId,
      date,
      (slots) => setResult({ key, slots, error: null }),
      (err) => setResult({ key, slots: [], error: err }),
    )
  }, [gameId, date])

  async function toggle(slot) {
    setBusyId(slot.id)
    setError('')
    try {
      await setSlotBlocked(slot.id, slot.status === 'open')
    } catch (err) {
      setError(err.code ? friendlyAuthError(err) : err.message)
    } finally {
      setBusyId(null)
    }
  }

  let content
  if (!gameId || !date) {
    content = <StateMessage type="empty">Pick a game and date.</StateMessage>
  } else if (loading) {
    content = <StateMessage type="loading" title="Loading slots…" />
  } else if (result.error) {
    content = (
      <StateMessage type="error" title="Could not load slots.">
        {friendlyAuthError(result.error)}
      </StateMessage>
    )
  } else if (result.slots.length === 0) {
    content = (
      <StateMessage type="empty" title="No slots for this date.">
        Generate slots below first.
      </StateMessage>
    )
  } else {
    content = (
      <ul className="list">
        {result.slots.map((slot) => (
          <li key={slot.id} className="slot-row">
            <span className="mono">{formatTimeRange(slot.start, slot.end)}</span>
            <span className={`tag slot-${slot.status}`}>{slot.status}</span>
            {slot.status === 'booked' ? (
              <span className="muted small">Cancel the booking to free it</span>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyId === slot.id}
                onClick={() => toggle(slot)}
              >
                {slot.status === 'open' ? 'Block' : 'Unblock'}
              </button>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="card stack">
      <h2>Slot availability</h2>
      <p className="muted small">Blocked slots can't be booked by customers.</p>

      <div className="row">
        <label className="field">
          <span>Game</span>
          <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {error && <StateMessage type="error">{error}</StateMessage>}
      {content}
    </section>
  )
}
