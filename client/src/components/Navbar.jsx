import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function Navbar() {
  const { user, logout } = useAuth()

  const navClass = ({ isActive }) =>
    `rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition ${
      isActive ? 'bg-white/20 text-white' : 'text-slate-200 hover:bg-white/10 hover:text-white'
    }`

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/15 bg-slate-950/30 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-white sm:text-xl">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-sm text-white shadow-lg shadow-cyan-800/30">
            G
          </span>
          Gig Shirudo
        </Link>

        <nav className="hidden items-center gap-2 sm:flex">
          {user ? (
            <>
              <NavLink to="/plans" className={navClass}>
                Plans
              </NavLink>
              <NavLink to="/dashboard" className={navClass}>
                Dashboard
              </NavLink>
              <NavLink to="/verification" className={navClass}>
                Verification
              </NavLink>
              <button
                onClick={handleLogout}
                className="rounded-full px-3 py-1.5 text-xs font-medium tracking-wide text-slate-200 hover:bg-white/10 hover:text-white transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/register" className={navClass}>
                Register
              </NavLink>
              <NavLink to="/login" className={navClass}>
                Login
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:flex">
          <p className="hidden text-xs font-medium text-cyan-100/85 sm:block">
            {user ? `${user.name}` : 'Code Blooded'}
          </p>
        </div>
      </div>
    </header>
  )
}
