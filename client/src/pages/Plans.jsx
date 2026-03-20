import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Card from '../components/Card'
import Button from '../components/Button'

export default function Plans() {
  const navigate = useNavigate()

  const plans = [
    {
      name: 'Basic',
      price: 250,
      coverage: 2000,
      tag: 'Starter safety for weekly disruptions',
      highlight: 'from-cyan-400/35 to-cyan-200/5',
    },
    {
      name: 'Standard',
      price: 300,
      coverage: 3500,
      tag: 'Balanced protection for active riders',
      highlight: 'from-sky-400/35 to-blue-200/5',
      recommended: true,
    },
    {
      name: 'Premium',
      price: 400,
      coverage: 6000,
      tag: 'High-tier buffer for uncertain days',
      highlight: 'from-amber-300/30 to-orange-200/5',
    },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#0f3b6f_0%,#08142e_45%,#040814_100%)] text-white">
      <div className="pointer-events-none absolute right-10 top-14 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute left-0 top-1/2 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

      <Navbar />

      <main className="relative mx-auto w-full max-w-6xl px-4 py-10">
        <div className="mb-8">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-100/90">
            Plan Studio
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Choose Your Plan</h2>
          <p className="mt-2 text-sm text-slate-100/85 sm:text-base">
            Pick one plan and jump to instant payout simulation.
          </p>
        </div>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className="flex flex-col">
              <div className={`mb-5 rounded-2xl bg-gradient-to-br p-4 ${plan.highlight}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-100/90">{plan.name}</p>
                  {plan.recommended ? (
                    <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-100">
                      Popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-3xl font-extrabold">Rs {plan.price}/week</p>
                <p className="mt-1 text-xs text-slate-100/85">Coverage: Rs {plan.coverage}</p>
              </div>

              <p className="grow text-sm text-slate-100/80">{plan.tag}</p>
              <ul className="mt-4 space-y-2 text-xs text-slate-200/85">
                <li>Instant trigger checks</li>
                <li>Weekly premium cycle</li>
                <li>One-click payout simulation</li>
              </ul>

              <Button
                className="mt-5 w-full"
                onClick={() =>
                  navigate('/payment', {
                    state: {
                      plan: {
                        name: plan.name,
                        price: plan.price,
                        coverage: plan.coverage,
                      },
                    },
                  })
                }
              >
                Select Plan
              </Button>
            </Card>
          ))}
        </section>
      </main>
    </div>
  )
}
