import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Card from '../components/Card'
import Button from '../components/Button'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#0f3b6f_0%,#08142e_45%,#040814_100%)] text-white">
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-32 left-1/4 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />

      <Navbar />

      <main className="relative mx-auto w-full max-w-6xl px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              🛡️ Parametric Insurance
            </span>
            <h1 className="text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
              Income Protection for
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-200 bg-clip-text text-transparent">
                Gig Economy Workers
              </span>
            </h1>
            <p className="max-w-xl text-lg text-slate-200/90">
              Instant payouts triggered by real-world disruptions. Rain, heat, pollution, or curfews - we've got you covered. No claims process. No delays. Pure protection.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Button className="px-8" onClick={() => navigate('/register')}>
                Register Now
              </Button>
              <Button variant="soft" className="px-8" onClick={() => navigate('/login')}>
                Sign In
              </Button>
            </div>

            <div className="pt-8 grid grid-cols-3 gap-4 border-t border-white/10">
              <div>
                <p className="text-3xl font-extrabold text-cyan-300">50K+</p>
                <p className="text-sm text-slate-400">Active Partners</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-emerald-300">₹5Cr+</p>
                <p className="text-sm text-slate-400">Payouts Processed</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-amber-300">2500+</p>
                <p className="text-sm text-slate-400">Events Triggered</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-300 text-sm font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold">Register</h3>
                    <p className="text-sm text-slate-300">Create an account in minutes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/20 text-sky-300 text-sm font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold">Choose Plan</h3>
                    <p className="text-sm text-slate-300">Pick coverage that fits your needs</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 text-sm font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold">Pay Securely</h3>
                    <p className="text-sm text-slate-300">Process payment instantly</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/20 text-amber-300 text-sm font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold">Get Protected</h3>
                    <p className="text-sm text-slate-300">Coverage activates immediately</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-cyan-400/30">
              <div className="space-y-3">
                <h3 className="font-semibold text-cyan-100">Why Choose Gig Shirudo?</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-300">✓</span> No documentation delays
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-300">✓</span> Instant parametric payouts
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-300">✓</span> Real-time notifications
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-300">✓</span> Verified identity & payouts
                  </li>
                </ul>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          <Card>
            <div className="space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/20">
                <span className="text-lg">🌧️</span>
              </div>
              <h3 className="font-semibold">Rain Protection</h3>
              <p className="text-sm text-slate-300">Triggered when rainfall exceeds 50mm. Get up to ₹800 coverage.</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/20">
                <span className="text-lg">🌡️</span>
              </div>
              <h3 className="font-semibold">Heat Wave Coverage</h3>
              <p className="text-sm text-slate-300">Activated when temperature reaches 42°C. Up to ₹600 protection.</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-400/20">
                <span className="text-lg">💨</span>
              </div>
              <h3 className="font-semibold">Air Quality Guard</h3>
              <p className="text-sm text-slate-300">Triggered when AQI exceeds 350. Receive up to ₹500 instantly.</p>
            </div>
          </Card>
        </div>
      </main>

      <footer className="mt-20 border-t border-white/10 py-8 text-center text-sm text-slate-400">
        <p>© 2024 Gig Shirudo. AI-Powered Parametric Insurance for Gig Workers.</p>
        <p className="mt-2">Built by Code Blooded</p>
      </footer>
    </div>
  )
}
