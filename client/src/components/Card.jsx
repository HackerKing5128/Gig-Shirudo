export default function Card({ children, className = '' }) {
  return (
    <div className={`relative w-full overflow-hidden rounded-3xl border border-white/20 bg-white/[0.08] p-6 backdrop-blur-2xl shadow-[0_24px_70px_-30px_rgba(15,23,42,0.9)] transition duration-300 hover:shadow-2xl ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-cyan-300/10" />
      <div className="relative">{children}</div>
    </div>
  )
}
