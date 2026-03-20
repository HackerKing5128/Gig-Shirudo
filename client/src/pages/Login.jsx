import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Navbar from '../components/Navbar'
import Card from '../components/Card'
import Button from '../components/Button'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const validateForm = () => {
    const newErrors = {}
    if (!email) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email format'
    if (!password) newErrors.password = 'Password is required'
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      login(email, password)
      setLoading(false)
      navigate('/plans')
    }, 1000)
  }

  const fillDemo = () => {
    setEmail('demo@gigshirudo.com')
    setPassword('demo123')
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#0f3b6f_0%,#08142e_45%,#040814_100%)] text-white">
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />

      <Navbar />

      <main className="relative mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <span className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
            Welcome Back
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Access your
            <span className="block bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-200 bg-clip-text text-transparent">
              protection dashboard
            </span>
          </h1>
          <p className="max-w-xl text-base text-slate-200/90 sm:text-lg">
            Log in to manage your coverage, view active claims, and access your payout verification status.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-100/90">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Real-time monitoring</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Instant notifications</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Verified payout</span>
          </div>
        </section>

        <Card className="max-w-xl">
          <h2 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">Sign In</h2>
          <p className="mb-6 text-sm text-slate-100/80">Enter your credentials to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`w-full rounded-xl border ${
                  errors.email ? 'border-red-500/50' : 'border-white/20'
                } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/55`}
              />
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`w-full rounded-xl border ${
                    errors.password ? 'border-red-500/50' : 'border-white/20'
                  } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/55`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-slate-300 mb-3">Demo Account:</p>
            <Button variant="soft" className="w-full mb-3" onClick={fillDemo}>
              Quick Fill Demo Credentials
            </Button>
            <p className="text-xs text-slate-400">Email: demo@gigshirudo.com | Password: demo123</p>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-slate-300">
              Don't have an account?{' '}
              <Link to="/register" className="text-cyan-300 hover:text-cyan-200 font-semibold">
                Register now
              </Link>
            </p>
          </div>
        </Card>
      </main>
    </div>
  )
}
