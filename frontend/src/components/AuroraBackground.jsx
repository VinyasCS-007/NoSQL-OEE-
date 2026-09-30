/**
 * Fixed full-page backdrop of slow-moving colour blobs, an optional grid and film grain. Put it once at the top of a page; it sits behind everything (-z-10).
 * @category Effects
 */
export function AuroraBackground({ intensity = 1, grid = true }) {
  return (
    <div aria-hidden className="noise pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div
        className="absolute -left-[15%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full blur-[110px]"
        style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 62%)', opacity: 0.28 * intensity, animation: 'aurora 22s ease-in-out infinite' }}
      />
      <div
        className="absolute -right-[20%] top-[5%] h-[60vmax] w-[60vmax] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, var(--accent-2) 0%, transparent 60%)', opacity: 0.2 * intensity, animation: 'aurora 26s ease-in-out infinite reverse' }}
      />
      <div
        className="absolute -bottom-[30%] left-[25%] h-[55vmax] w-[55vmax] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, var(--accent-3) 0%, transparent 60%)', opacity: 0.16 * intensity, animation: 'aurora 30s ease-in-out infinite' }}
      />
      {grid && <div className="bg-grid absolute inset-0" />}
    </div>
  )
}

export default AuroraBackground
