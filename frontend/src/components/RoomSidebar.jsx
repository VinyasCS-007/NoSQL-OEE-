import { AnimatePresence, motion } from 'framer-motion'
import { Hash, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Skeleton } from './ui'

const list = { show: { transition: { staggerChildren: 0.035 } } }
const item = { hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }

/**
 * Room navigation: create-room field, a list of public rooms with an animated active pill, a filter when there are many rooms, and loading skeletons.
 * @category Chat
 */
export function RoomSidebar({ rooms, loading, activeId, onSelect, onCreate }) {
  const [name, setName] = useState('')
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      await onCreate(name.trim())
      setName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const shown = rooms.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form onSubmit={submit} className="px-3 pt-4">
        <div className="group flex items-center gap-1.5 rounded-2xl border border-border bg-surface-2 p-1.5 transition focus-within:border-accent/60 focus-within:shadow-[0_0_0_4px_var(--accent-soft)]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="Create a room…"
            aria-label="New room name"
            className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted/70"
          />
          <motion.button
            whileHover={{ rotate: 90, scale: 1.08 }}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            disabled={busy || !name.trim()}
            aria-label="Create room"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand text-on-accent shadow-[0_6px_16px_-6px_var(--glow)] disabled:opacity-40"
          >
            <Plus size={16} strokeWidth={2.5} />
          </motion.button>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 px-1 text-xs text-danger" role="alert">
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </form>

      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Public rooms</p>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted">{rooms.length}</span>
      </div>
      {rooms.length > 6 && (
        <label className="mx-3 mb-2 flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-muted focus-within:bg-surface-2">
          <Search size={14} />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" aria-label="Filter rooms" className="w-full bg-transparent text-sm outline-none" />
        </label>
      )}

      <nav className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Rooms">
        {loading ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="mx-2 my-2 h-10" />)
        ) : (
          <motion.ul variants={list} initial="hidden" animate="show">
            {shown.map((room) => {
              const active = room.id === activeId
              return (
                <motion.li key={room.id} variants={item}>
                  <motion.button
                    onClick={() => onSelect(room.id)}
                    aria-current={active ? 'page' : undefined}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors
                      ${active ? 'font-semibold text-text' : 'text-muted hover:text-text'}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="room-active"
                        className="absolute inset-0 rounded-2xl border border-accent/25 bg-accent-soft shadow-[0_8px_24px_-14px_var(--glow)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${active ? 'bg-brand text-on-accent shadow-[0_4px_12px_-4px_var(--glow)]' : 'bg-surface-2'}`}>
                      <Hash size={14} strokeWidth={2.5} />
                    </span>
                    <span className="relative truncate">{room.name}</span>
                  </motion.button>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
        {!loading && rooms.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted">No rooms yet.<br />Create the first one ✨</p>
        )}
      </nav>
    </div>
  )
}

export default RoomSidebar
