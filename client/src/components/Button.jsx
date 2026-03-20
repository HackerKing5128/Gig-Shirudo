const variants = {
  primary:
    'bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 text-white shadow-[0_12px_35px_-12px_rgba(14,165,233,0.8)] hover:brightness-110',
  soft:
    'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20',
}

export default function Button({
  children,
  onClick,
  className = '',
  type = 'button',
  variant = 'primary',
  disabled = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold tracking-wide transition-all duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
