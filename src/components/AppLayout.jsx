// Layout for every signed-in page: navbar on top, page content below.
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'

export default function AppLayout() {
  return (
    <>
      <Navbar />
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
