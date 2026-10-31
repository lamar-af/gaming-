// One component for loading, empty, success, and error states on every page.
import Mascot from './Mascot.jsx'

const LABELS = {
  loading: 'Loading',
  empty: 'Nothing here',
  success: 'Done',
  error: 'Something went wrong',
}

export default function StateMessage({ type = 'loading', title, children }) {
  // Errors interrupt screen readers; the others are announced politely.
  const role = type === 'error' ? 'alert' : 'status'

  return (
    <div className={`state state-${type}`} role={role}>
      {type === 'empty' && <Mascot size={96} />}
      <span className="state-label">{LABELS[type]}</span>
      {title && <strong className="state-title">{title}</strong>}
      {children && <div className="state-body">{children}</div>}
    </div>
  )
}
