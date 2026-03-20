import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Navbar from '../components/Navbar'
import Card from '../components/Card'
import Button from '../components/Button'

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [payout, setPayout] = useState(null)
  const [event, setEvent] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedPlan = location.state?.plan || user?.selectedPlan || {
    name: 'Standard',
    price: 50,
    coverage: 1500,
  }

  function simulate(type) {
    setLoading(true)
    setPayout(null)
    setEvent('')

    setTimeout(() => {
      let amount = 0

      if (type === 'rain') amount = 800
      if (type === 'heat') amount = 600
      if (type === 'pollution') amount = 500
      if (type === 'curfew') amount = 1000
      if (type === 'outage') amount = 700

      setEvent(type)
      setPayout(amount)
      setLoading(false)
    }, 1500)
  }

  const triggerCondition =
    event === 'rain'
      ? 'Rainfall > 50mm'
      : event === 'heat'
        ? 'Temperature > 42C'
        : event === 'pollution'
          ? 'AQI > 350'
          : event === 'curfew'
            ? 'Government Curfew Alert'
            : event === 'outage'
              ? 'Platform Downtime > 30 mins'
              : ''

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#0f3b6f_0%,#08142e_45%,#040814_100%)] text-white">
      <div className="pointer-events-none absolute -left-20 top-28 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

      <Navbar />

      <main className="relative mx-auto w-full max-w-5xl px-4 py-10">
        <div className="mb-8">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-100/90">
            Dashboard
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Welcome {user?.name || 'Partner'}</h2>
          <p className="mt-2 text-sm text-slate-100/85">
            Manage your coverage and test disruption events
          </p>
        </div>

        <div className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Account Status</p>
                <p className="text-2xl font-bold text-emerald-300">Active</p>
              </div>
            </Card>

            <Card>
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Current Plan</p>
                <p className="text-2xl font-bold">{selectedPlan.name}</p>
                <p className="text-xs text-slate-400">₹{selectedPlan.price}/week</p>
              </div>
            </Card>

            <Card>
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Coverage Limit</p>
                <p className="text-2xl font-bold text-cyan-300">₹{selectedPlan.coverage}</p>
              </div>
            </Card>
          </div>

          <Card>
            <h3 className="mb-2 text-lg font-semibold">System Status</h3>
            <p className="text-emerald-300">● All Systems Operational</p>
            <p className="mt-1 text-sm text-slate-300">Monitoring: Weather • AQI • Traffic • Location</p>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <h3 className="mb-2 text-lg font-semibold">Your Policy</h3>
              <p className="text-sm text-slate-200">Plan: {selectedPlan.name}</p>
              <p className="text-sm text-slate-200">Premium: ₹{selectedPlan.price}/week</p>
              <p className="text-sm text-slate-200">Coverage Limit: ₹{selectedPlan.coverage}</p>
              <p className="text-sm text-slate-200 mt-3">Member Since: {user?.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'Today'}</p>
            </Card>

            <Card>
              <h3 className="mb-2 text-lg font-semibold">Fraud Protection</h3>
              <p className="text-emerald-300">Low Risk Activity</p>
              <p className="mt-1 text-sm text-slate-300">Behavior, device signals and location verified</p>

              {user?.verificationApplied ? (
                <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
                  <p className="text-sm font-semibold text-amber-300">⏳ Verification Pending</p>
                  <p className="text-xs text-slate-300 mt-1">Your documents are under review (24-48 hours)</p>
                </div>
              ) : (
                <Button
                  variant="soft"
                  className="w-full mt-4"
                  onClick={() => navigate('/verification')}
                >
                  Apply for Payout Verification
                </Button>
              )}
            </Card>
          </div>

          <Card>
            <h3 className="mb-4 text-xl font-bold">Simulate Disruption Event</h3>
            <p className="text-sm text-slate-300 mb-4">Test how instant payouts work by simulating real-world disruption events</p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Button className="w-full" disabled={loading} onClick={() => simulate('rain')}>
                🌧️ Rain Event
              </Button>
              <Button className="w-full" disabled={loading} onClick={() => simulate('heat')}>
                🌡️ Heatwave Event
              </Button>
              <Button className="w-full" disabled={loading} onClick={() => simulate('pollution')}>
                💨 Pollution Spike
              </Button>
              <Button className="w-full" disabled={loading} onClick={() => simulate('curfew')}>
                🚨 Curfew Alert
              </Button>
              <Button className="w-full" disabled={loading} onClick={() => simulate('outage')}>
                📱 Platform Outage
              </Button>
            </div>

            {loading ? (
              <p className="mt-4 text-sm font-semibold text-amber-300">Analyzing disruption...</p>
            ) : (
              <p className="mt-4 text-xs text-slate-300">Simulation checks threshold conditions before payout.</p>
            )}
          </Card>

          {payout ? (
            <Card>
              <h3 className="text-xl font-bold text-emerald-300">✓ Parametric Trigger Activated</h3>
              <p className="mt-2 text-sm text-slate-200">Condition Met: {triggerCondition}</p>
              <p className="mt-3 text-base text-slate-200">
                Event: <span className="capitalize font-semibold">{event}</span>
              </p>
              <p className="mt-2 bg-gradient-to-r from-cyan-200 to-emerald-200 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
                Payout: ₹{payout}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                  <p className="text-slate-300">Settlement</p>
                  <p className="mt-1 font-semibold text-emerald-300">Instant</p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                  <p className="text-slate-300">Status</p>
                  <p className="mt-1 font-semibold text-emerald-300">Paid</p>
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-600/10 border-blue-400/30">
            <div className="space-y-3">
              <h3 className="font-semibold">Next Steps</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <span>→</span>
                  <span>Verify your identity for payout eligibility</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>→</span>
                  <span>Test disruption events to see payouts in action</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>→</span>
                  <span>Upgrade or downgrade your plan anytime</span>
                </li>
              </ul>
              <Button className="w-full mt-3" onClick={() => navigate('/verification')}>
                Complete Verification Now
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
