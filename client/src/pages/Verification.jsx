import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Navbar from '../components/Navbar'
import Card from '../components/Card'
import Button from '../components/Button'

export default function Verification() {
  const navigate = useNavigate()
  const { user, applyForVerification } = useAuth()
  const [step, setStep] = useState('form') // form, review, submitted
  const [bankDetails, setBankDetails] = useState({
    accountHolder: user?.name || '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    accountType: 'savings',
  })
  const [pan, setPan] = useState('')
  const [aadhar, setAadhar] = useState('')
  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}
    if (!bankDetails.accountHolder) newErrors.accountHolder = 'Account holder name is required'
    if (!bankDetails.accountNumber || bankDetails.accountNumber.length < 10)
      newErrors.accountNumber = 'Valid account number is required (min 10 digits)'
    if (!bankDetails.ifscCode || bankDetails.ifscCode.length !== 11)
      newErrors.ifscCode = 'IFSC code must be 11 characters'
    if (!bankDetails.bankName) newErrors.bankName = 'Bank name is required'
    if (!pan) newErrors.pan = 'PAN is required'
    if (!aadhar || aadhar.length !== 12) newErrors.aadhar = 'Aadhar must be 12 digits'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return
    setStep('review')
  }

  const handleConfirmSubmission = () => {
    applyForVerification({ ...bankDetails, pan, aadhar })
    setStep('submitted')
  }

  if (step === 'submitted') {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#0f3b6f_0%,#08142e_45%,#040814_100%)] text-white">
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />

        <Navbar />

        <main className="relative mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-4xl items-center gap-8 px-4 py-10">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full blur-lg opacity-75 animate-pulse" />
                <div className="relative bg-gradient-to-br from-amber-400 to-orange-400 p-6 rounded-full">
                  <svg
                    className="w-16 h-16 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight">Application Submitted</h1>
              <p className="text-lg text-slate-300">We've received your payout verification request</p>
            </div>

            <Card className="my-8">
              <div className="text-left space-y-4">
                <div className="pb-4 border-b border-white/10">
                  <p className="text-sm text-slate-300">Status</p>
                  <p className="text-2xl font-bold text-amber-300">Under Review</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-slate-300">We're verifying your documents. This usually takes 24-48 hours.</p>
                  <p className="text-sm text-slate-400">
                    PAN: {pan.slice(-4).padStart(12, '*')}
                  </p>
                  <p className="text-sm text-slate-400">
                    Account: {bankDetails.accountNumber.slice(-4).padStart(bankDetails.accountNumber.length, '*')}
                  </p>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                You'll receive email notification once your verification is complete.
              </p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => navigate('/dashboard')}>
                  Back to Dashboard
                </Button>
                <Button
                  variant="soft"
                  className="flex-1"
                  onClick={() => navigate('/plans')}
                >
                  Explore Plans
                </Button>
              </div>
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
            Payout Verification
          </span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {step === 'form' ? 'Apply for Payout Verification' : 'Review Your Details'}
          </h2>
          <p className="mt-2 text-sm text-slate-100/85 sm:text-base">
            {step === 'form'
              ? 'Verify your banking details to unlock payout features'
              : 'Please verify your information before submitting'}
          </p>
        </div>

        {step === 'form' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Bank Account Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                          Account Holder Name
                        </label>
                        <input
                          type="text"
                          value={bankDetails.accountHolder}
                          onChange={(e) =>
                            setBankDetails({ ...bankDetails, accountHolder: e.target.value })
                          }
                          placeholder="Your full name"
                          className={`w-full rounded-xl border ${
                            errors.accountHolder ? 'border-red-500/50' : 'border-white/20'
                          } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70`}
                        />
                        {errors.accountHolder && (
                          <p className="text-xs text-red-400 mt-1">{errors.accountHolder}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                          Bank Account Number
                        </label>
                        <input
                          type="text"
                          value={bankDetails.accountNumber}
                          onChange={(e) =>
                            setBankDetails({ ...bankDetails, accountNumber: e.target.value })
                          }
                          placeholder="Enter account number"
                          className={`w-full rounded-xl border ${
                            errors.accountNumber ? 'border-red-500/50' : 'border-white/20'
                          } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 font-mono`}
                        />
                        {errors.accountNumber && (
                          <p className="text-xs text-red-400 mt-1">{errors.accountNumber}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                            IFSC Code
                          </label>
                          <input
                            type="text"
                            value={bankDetails.ifscCode}
                            onChange={(e) =>
                              setBankDetails({
                                ...bankDetails,
                                ifscCode: e.target.value.toUpperCase(),
                              })
                            }
                            placeholder="SBIN0000001"
                            maxLength="11"
                            className={`w-full rounded-xl border ${
                              errors.ifscCode ? 'border-red-500/50' : 'border-white/20'
                            } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 font-mono`}
                          />
                          {errors.ifscCode && (
                            <p className="text-xs text-red-400 mt-1">{errors.ifscCode}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                            Account Type
                          </label>
                          <select
                            value={bankDetails.accountType}
                            onChange={(e) =>
                              setBankDetails({ ...bankDetails, accountType: e.target.value })
                            }
                            className="w-full rounded-xl border border-white/20 bg-slate-900/35 px-4 py-3 text-white outline-none transition focus:border-cyan-300/70"
                          >
                            <option value="savings">Savings</option>
                            <option value="current">Current</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={bankDetails.bankName}
                          onChange={(e) =>
                            setBankDetails({ ...bankDetails, bankName: e.target.value })
                          }
                          placeholder="State Bank of India"
                          className={`w-full rounded-xl border ${
                            errors.bankName ? 'border-red-500/50' : 'border-white/20'
                          } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70`}
                        />
                        {errors.bankName && (
                          <p className="text-xs text-red-400 mt-1">{errors.bankName}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-6">
                    <h3 className="text-lg font-semibold mb-4">Identity Verification</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                          PAN Number
                        </label>
                        <input
                          type="text"
                          value={pan}
                          onChange={(e) => setPan(e.target.value.toUpperCase())}
                          placeholder="ABCDE1234F"
                          maxLength="10"
                          className={`w-full rounded-xl border ${
                            errors.pan ? 'border-red-500/50' : 'border-white/20'
                          } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 font-mono`}
                        />
                        {errors.pan && <p className="text-xs text-red-400 mt-1">{errors.pan}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-200 mb-2">
                          Aadhar Number
                        </label>
                        <input
                          type="text"
                          value={aadhar}
                          onChange={(e) => setAadhar(e.target.value.slice(0, 12))}
                          placeholder="123456789012"
                          maxLength="12"
                          className={`w-full rounded-xl border ${
                            errors.aadhar ? 'border-red-500/50' : 'border-white/20'
                          } bg-slate-900/35 px-4 py-3 text-white placeholder-slate-300/80 outline-none transition focus:border-cyan-300/70 font-mono`}
                        />
                        {errors.aadhar && (
                          <p className="text-xs text-red-400 mt-1">{errors.aadhar}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" onClick={handleSubmit}>
                    Review Details
                  </Button>
                </div>
              </Card>
            </div>

            <div>
              <Card>
                <h3 className="text-lg font-semibold mb-4">Why Verify?</h3>
                <div className="space-y-3 text-sm text-slate-300">
                  <p className="flex items-start gap-2">
                    <span className="text-cyan-300 mt-1">✓</span>
                    <span>Enable instant payouts</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-cyan-300 mt-1">✓</span>
                    <span>Secure & encrypted</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-cyan-300 mt-1">✓</span>
                    <span>One-time verification</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-cyan-300 mt-1">✓</span>
                    <span>RBI compliant</span>
                  </p>
                </div>
              </Card>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Bank Details Summary</h3>
                    <div className="space-y-3 pb-4 border-b border-white/10">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Account Holder</span>
                        <span className="font-medium">{bankDetails.accountHolder}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Account Number</span>
                        <span className="font-mono">{bankDetails.accountNumber.slice(-4).padStart(bankDetails.accountNumber.length, '*')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">IFSC Code</span>
                        <span className="font-mono">{bankDetails.ifscCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Bank Name</span>
                        <span className="font-medium">{bankDetails.bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Account Type</span>
                        <span className="font-medium capitalize">{bankDetails.accountType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pb-6 border-b border-white/10">
                    <h3 className="text-lg font-semibold mb-4">Identity Verification</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">PAN</span>
                        <span className="font-mono">{pan.slice(-4).padStart(10, '*')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Aadhar</span>
                        <span className="font-mono">{aadhar.slice(-4).padStart(12, '*')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="soft"
                      className="flex-1"
                      onClick={() => setStep('form')}
                    >
                      Edit Details
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleConfirmSubmission}
                    >
                      Confirm & Submit
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            <div>
              <Card>
                <h3 className="text-lg font-semibold mb-4">Verification Info</h3>
                <div className="space-y-3 text-sm text-slate-300">
                  <p className="flex items-start gap-2">
                    <span className="text-amber-300 mt-1">⚠</span>
                    <span>Ensure all details match your official documents</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-300 mt-1">⏱</span>
                    <span>Verification takes 24-48 hours</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-amber-300 mt-1">🔒</span>
                    <span>Your data is encrypted & secure</span>
                  </p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
