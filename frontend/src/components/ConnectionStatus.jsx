import { AnimatePresence, motion } from 'framer-motion'

const LABELS = { open: 'Live', connecting: 'Connecting', closed: 'Reconnecting' }

export default function ConnectionStatus({ status }) {
  const live = status === 'open'
  return (
    <motion.div
      layout
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold
        ${live ? 'border-member/25 bg-member-soft text-member' : 'border-guest/25 bg-guest-soft text-guest'}`}
      role="status"
      aria-live="polite"
    >
      {live ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-member opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-member shadow-[0_0_8px_var(--member)]" />
        </span>
      ) : (
        // typing-style dots while the socket is (re)connecting
        <span className="flex gap-[3px]" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-guest"
              animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </span>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={status} initial={{ opacity: 0, rotateX: -90 }} animate={{ opacity: 1, rotateX: 0 }} exit={{ opacity: 0, rotateX: 90 }} transition={{ duration: 0.18 }}>
          {LABELS[status]}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  )
}
