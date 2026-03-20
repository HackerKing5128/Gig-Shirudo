import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Navbar from '../components/Navbar'
import Card from '../components/Card'
import Button from '../components/Button'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    city: '',
    platform: '',
    weeklyIncome: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const validateForm = () => {
    const newErrors = {}
    if (!formData.name) newErrors.name = 'Name is required'
    if (!formData.email) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format'
    if (!formData.city) newErrors.city = 'City is required'
    if (!formData.platform) newErrors.platform = 'Select your delivery platform'
    if (!formData.weeklyIncome) newErrors.weeklyIncome = 'Weekly income is required'
    else if (isNaN(formData.weeklyIncome) || formData.weeklyIncome < 0) newErrors.weeklyIncome = 'Enter valid income'
    if (!formData.password) newErrors.password = 'Password is required'
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setTimeout(() => {
      register(formData)
      setLoading(false)
      navigate('/plans')
    }, 1000)
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
            Resilience Protocol
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Protect every ride with
            <span className="block bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-200 bg-clip-text text-transparent">
              instant disruption cover
            </span>
          </h1>
          <p className="max-w-xl text-base text-slate-200/90 sm:text-lg">
            Join thousands of delivery partners already protected. One-time registration, choose your plan, get instant coverage.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-slate-100/90">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">✓ Secure registration</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">✓ Instant activation</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">✓ Verified payouts</span>
          </div>
        </section>

        <Card className="max-w-xl">
          <h2 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">Create Account</h2>
          <p className="mb-6 text-sm text-slate-100/80">Register as a delivery partner in 2 minutes.</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                className={`w-full rounded-xl border ${
                  errors.name ? 'border-red-500/50' : 'border-white/20'
                } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/55`}
              />
              {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                className={`w-full rounded-xl border ${
                  errors.email ? 'border-red-500/50' : 'border-white/20'
                } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/55`}
              />
              {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Delhi"
                className={`w-full rounded-xl border ${
                  errors.city ? 'border-red-500/50' : 'border-white/20'
                } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/55`}
              />
              {errors.city && <p className="text-xs text-red-400 mt-1">{errors.city}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1">Delivery Platform</label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                className={`w-full rounded-xl border ${
                  errors.platform ? 'border-red-500/50' : 'border-white/20'
                } bg-slate-900/35 px-4 py-3 text-white outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/55`}
              >
                <option value="">Select platform</option>
                <option value="Zomato">Zomato</option>
                <option value="Swiggy">Swiggy</option>
                <option value="Blinkit">Blinkit</option>
                <option value="Other">Other</option>
              </select>
              {errors.platform && <p className="text-xs text-red-400 mt-1">{errors.platform}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1">Weekly Income (₹)</label>
              <input
                type="number"
                value={formData.weeklyIncome}
                onChange={(e) => setFormData({ ...formData, weeklyIncome: e.target.value })}
                placeholder="5000"
                className={`w-full rounded-xl border ${
                  errors.weeklyIncome ? 'border-red-500/50' : 'border-white/20'
                } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/55`}
              />
              {errors.weeklyIncome && <p className="text-xs text-red-400 mt-1">{errors.weeklyIncome}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className={`w-full rounded-xl border ${
                  errors.password ? 'border-red-500/50' : 'border-white/20'
                } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/55`}
              />
              {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-1">Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className={`w-full rounded-xl border ${
                  errors.confirmPassword ? 'border-red-500/50' : 'border-white/20'
                } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 focus:bg-slate-900/55`}
              />
              {errors.confirmPassword && <p className="text-xs text-red-400 mt-1">{errors.confirmPassword}</p>}
            </div>

            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-slate-300">
              Already have an account?{' '}
              <Link to="/login" className="text-cyan-300 hover:text-cyan-200 font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </main>
    </div>
  )
}
