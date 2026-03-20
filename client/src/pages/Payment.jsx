import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Navbar from '../components/Navbar'
import Card from '../components/Card'
import Button from '../components/Button'

export default function Payment() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, selectPlan } = useAuth()
  const [loading, setLoading] = useState(false)
  const [paymentStep, setPaymentStep] = useState('review') // review, details, processing, success
  const [cardDetails, setCardDetails] = useState({
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  })
  const [errors, setErrors] = useState({})

  const plan = location.state?.plan || user?.selectedPlan || {
    name: 'Standard',
    price: 50,
    coverage: 1500,
  }

  const validateCardDetails = () => {
    const newErrors = {}
    if (!cardDetails.cardName) newErrors.cardName = 'Cardholder name is required'
    if (!cardDetails.cardNumber || cardDetails.cardNumber.length < 16)
      newErrors.cardNumber = 'Valid card number is required'
    if (!cardDetails.expiry || cardDetails.expiry.length < 5) newErrors.expiry = 'Valid expiry is required'
    if (!cardDetails.cvv || cardDetails.cvv.length < 3) newErrors.cvv = 'Valid CVV is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePayment = () => {
    if (!validateCardDetails()) return

    setLoading(true)
    setPaymentStep('processing')

    setTimeout(() => {
      // Simulate payment processing
      selectPlan(plan)
      setLoading(false)
      setPaymentStep('success')
    }, 2500)
  }

  const handleContinue = () => {
    navigate('/dashboard', { state: { plan } })
  }

  if (paymentStep === 'success') {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#0f3b6f_0%,#08142e_45%,#040814_100%)] text-white">
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />

        <Navbar />

        <main className="relative mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-4xl items-center gap-8 px-4 py-10">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full blur-lg opacity-75 animate-pulse" />
                <div className="relative bg-gradient-to-br from-emerald-400 to-cyan-400 p-6 rounded-full">
                  <svg
                    className="w-16 h-16 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight">Payment Successful</h1>
              <p className="text-lg text-slate-300">Your plan has been activated</p>
            </div>

            <Card className="my-8">
              <div className="text-left space-y-4">
                <div className="pb-4 border-b border-white/10">
                  <p className="text-sm text-slate-300">Plan Selected</p>
                  <p className="text-2xl font-bold">{plan.name} Plan</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Weekly Premium</p>
                    <p className="text-xl font-bold text-cyan-300">₹{plan.price}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Coverage</p>
                    <p className="text-xl font-bold text-emerald-300">₹{plan.coverage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Status</p>
                    <p className="text-xl font-bold text-emerald-300">Active</p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              <Button className="w-full" onClick={handleContinue}>
                Go to Dashboard
              </Button>
              <Button
                variant="soft"
                className="w-full"
                onClick={() => navigate('/plans')}
              >
                View Other Plans
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#0f3b6f_0%,#08142e_45%,#040814_100%)] text-white">
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />

      <Navbar />

      <main className="relative mx-auto w-full max-w-4xl px-4 py-10">
        <div className="mb-8">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-100/90">
            Secure Checkout
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Payment Portal</h2>
          <p className="mt-2 text-sm text-slate-100/85 sm:text-base">Complete your plan subscription</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              {paymentStep === 'review' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Order Review</h3>
                    <div className="space-y-3 pb-4 border-b border-white/10">
                      <div className="flex justify-between">
                        <span className="text-slate-300">{plan.name} Plan</span>
                        <span className="font-semibold">₹{plan.price}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Weekly Subscription</span>
                        <span className="text-xs text-slate-400">Recurring</span>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-between">
                      <span className="font-semibold text-lg">Total</span>
                      <span className="text-2xl font-extrabold text-cyan-300">₹{plan.price}</span>
                    </div>
                  </div>

                  <Button className="w-full" onClick={() => setPaymentStep('details')}>
                    Proceed to Payment
                  </Button>
                </div>
              )}

              {paymentStep === 'details' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Card Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                          Cardholder Name
                        </label>
                        <input
                          type="text"
                          value={cardDetails.cardName}
                          onChange={(e) => setCardDetails({ ...cardDetails, cardName: e.target.value })}
                          placeholder="John Doe"
                          className={`w-full rounded-xl border ${
                            errors.cardName ? 'border-red-500/50' : 'border-white/20'
                          } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70`}
                        />
                        {errors.cardName && <p className="text-xs text-red-400 mt-1">{errors.cardName}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                          Card Number
                        </label>
                        <input
                          type="text"
                          value={cardDetails.cardNumber}
                          onChange={(e) =>
                            setCardDetails({ ...cardDetails, cardNumber: e.target.value.slice(0, 19) })
                          }
                          placeholder="1234 5678 9012 3456"
                          maxLength="19"
                          className={`w-full rounded-xl border ${
                            errors.cardNumber ? 'border-red-500/50' : 'border-white/20'
                          } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 font-mono`}
                        />
                        {errors.cardNumber && <p className="text-xs text-red-400 mt-1">{errors.cardNumber}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                            Expiry
                          </label>
                          <input
                            type="text"
                            value={cardDetails.expiry}
                            onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                            placeholder="MM/YY"
                            maxLength="5"
                            className={`w-full rounded-xl border ${
                              errors.expiry ? 'border-red-500/50' : 'border-white/20'
                            } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70`}
                          />
                          {errors.expiry && <p className="text-xs text-red-400 mt-1">{errors.expiry}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                            CVV
                          </label>
                          <input
                            type="text"
                            value={cardDetails.cvv}
                            onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value.slice(0, 4) })}
                            placeholder="123"
                            maxLength="4"
                            className={`w-full rounded-xl border ${
                              errors.cvv ? 'border-red-500/50' : 'border-white/20'
                            } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 font-mono`}
                          />
                          {errors.cvv && <p className="text-xs text-red-400 mt-1">{errors.cvv}</p>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="soft"
                      className="flex-1"
                      onClick={() => setPaymentStep('review')}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handlePayment}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : 'Pay ₹' + plan.price}
                    </Button>
                  </div>
                </div>
              )}

              {paymentStep === 'processing' && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full blur-lg opacity-50 animate-spin" />
                    <div className="relative w-full h-full bg-slate-900/50 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-cyan-400 animate-spin"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">Processing Payment</p>
                    <p className="text-sm text-slate-400 mt-1">Please do not close this window</p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div>
            <Card>
              <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
              <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                <div className="flex justify-between">
                  <span className="text-slate-400">{plan.name} Plan</span>
                  <span className="font-semibold">₹{plan.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coverage Limit</span>
                  <span className="font-semibold text-cyan-300">₹{plan.coverage}</span>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">Total Amount</span>
                  <span className="text-2xl font-extrabold text-cyan-300">₹{plan.price}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-400">
                <p className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Instant activation after payment</span>
                </p>
                <p className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Auto-renews every week</span>
                </p>
                <p className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Cancel anytime</span>
                </p>
                <p className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Secure & encrypted</span>
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
