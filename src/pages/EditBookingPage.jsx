import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import StateMessage from '../components/StateMessage.jsx'
import BookingForm from '../components/BookingForm.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import {
  canModifyBooking,
  editBooking,
  getBooking,
  getGames,
  venueDateOf,
} from '../lib/scheduling.js'
import { formatDate, formatTimeRange } from '../lib/format.js'
import { friendlyAuthError } from '../lib/authErrors.js'
import { EDIT_LOCK_LABEL } from '../config.js'

export default function EditBookingPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState({ loaded: false, booking: null, games: [], error: '' })

  useEffect(() => {
    Promise.all([getBooking(id), getGames()])
      .then(([booking, games]) => setData({ loaded: true, booking, games, error: '' }))
      .catch((err) => setData({ loaded: true, booking: null, games: [], error: friendlyAuthError(err) }))
  }, [id])

  async function handleSave({ slot, players }) {
    await editBooking(id, user.uid, { slotId: slot.id, players })
    navigate('/my-bookings', { replace: true, state: { message: 'Changes saved.' } })
  }

  const { loaded, booking, games, error } = data
  const backLink = (
    <Link to="/my-bookings" className="btn btn-ghost">
      Back to my bookings
    </Link>
  )

  let content
  if (!loaded) {
    content = <StateMessage type="loading" title="Loading booking…" />
  } else if (error) {
    content = <StateMessage type="error" title="Could not load this booking.">{error}</StateMessage>
  } else if (!booking || booking.userId !== user.uid) {
    content = (
      <div className="stack">
        <StateMessage type="empty" title="Booking not found." />
        <div>{backLink}</div>
      </div>
    )
  } else if (!canModifyBooking(booking)) {
    content = (
      <div className="stack">
        <StateMessage type="error" title="This booking can't be changed.">
          {booking.status === 'cancelled'
            ? 'It has been cancelled.'
            : `Changes close ${EDIT_LOCK_LABEL} before your session.`}
        </StateMessage>
        <div>{backLink}</div>
      </div>
    )
  } else {
    const date = venueDateOf(booking.start)
    content = (
      <div className="stack">
        <StateMessage type="success" title="Current booking">
          {booking.gameName} · {formatDate(booking.start)} ·{' '}
          {formatTimeRange(booking.start, booking.end)} · {booking.players} player(s)
        </StateMessage>
        <BookingForm
          games={games}
          initial={{ gameId: booking.gameId, date, players: booking.players }}
          currentSlot={{
            id: booking.slotId,
            gameId: booking.gameId,
            date,
            start: booking.start,
            end: booking.end,
          }}
          submitLabel="Save changes"
          submittingLabel="Saving…"
          onSubmit={handleSave}
          secondaryAction={
            <Link to="/my-bookings" className="btn btn-ghost btn-big">
              Keep it as it is
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Change your booking</h1>
        <p>
          You can change the game, day, time, or players until {EDIT_LOCK_LABEL} before
          your session.
        </p>
      </div>
      {content}
    </div>
  )
}
