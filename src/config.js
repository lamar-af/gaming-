// Business settings for the venue, kept in one place so they are easy to change.

export const TIMEZONE = 'Asia/Riyadh'
// Riyadh is always UTC+3 (Saudi Arabia has no daylight saving time).
export const RIYADH_UTC_OFFSET_HOURS = 3

// Opening hours (24h clock, venue local time).
// First session starts at OPEN_HOUR, last session starts at LAST_START_HOUR.
export const OPEN_HOUR = 12
export const CLOSE_HOUR = 22
export const LAST_START_HOUR = 21

export const SESSION_MINUTES = 60
export const MIN_PLAYERS = 1
export const MAX_PLAYERS = 7

// Customers can edit or cancel only until this many hours before the session.
export const EDIT_LOCK_HOURS = 1
// For messages: "1 hour" / "6 hours". (firestore.rules has the same number: duration.value(1, 'h').)
export const EDIT_LOCK_LABEL = `${EDIT_LOCK_HOURS} hour${EDIT_LOCK_HOURS === 1 ? '' : 's'}`

// Display color per game (visual only, from the Bubble Quest design).
export const GAME_COLORS = {
  'the-maze': '#2E9E6A',
  'escape-room': '#E8484D',
  'mystery-lab': '#FFC857',
}
export const DEFAULT_GAME_COLOR = '#8E7DFF'

// Starting games, used by the admin "seed games" button.
// Once seeded, names live in Firestore and can be changed there.
export const DEFAULT_GAMES = [
  {
    id: 'the-maze',
    name: 'The Maze',
    description: 'Find your way out before the hour runs out.',
    order: 1,
  },
  {
    id: 'escape-room',
    name: 'Escape Room',
    description: 'Solve the puzzles and unlock the door.',
    order: 2,
  },
  {
    id: 'mystery-lab',
    name: 'Mystery Lab',
    description: 'Investigate the lab and crack the case.',
    order: 3,
  },
]
