import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, History } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import { Skeleton } from './ui'

const sameSender = (a, b) => a && b && a.sender.alias === b.sender.alias && a.sender.type === b.sender.type

function EmptyState() {
  return (
    <div className="grid h-full place-items-center text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
        <div className="relative mx-auto mb-5 h-20 w-20 perspective-[600px]">
          <motion.div
            animate={{ rotateY: [0, 18, -18, 0], y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="grid h-full w-full place-items-center rounded-[26px] bg-brand text-3xl shadow-[0_20px_50px_-15px_var(--glow)]"
          >
            👋
          </motion.div>
        </div>
        <p className="text-base font-semibold">It's quiet in here</p>
        <p className="mt-1 text-sm text-muted">Be the first to say hi.</p>
      </motion.div>
    </div>
  )
}

/**
 * Scrollable message history. Auto-scrolls to new messages, keeps position when older messages are prepended, and shows loading skeletons, an empty state and a jump-to-latest button.
 * @category Chat
 */
export function MessageList({ messages, loading, me, hasMore, loadingOlder, onLoadOlder, onImage }) {
  const boxRef = useRef(null)
  const stickToBottom = useRef(true)
  const prevHeight = useRef(0)
  const [showJump, setShowJump] = useState(false)
  const lastId = messages.at(-1)?.id

  // remember whether the user is near the bottom before new content arrives
  const onScroll = () => {
    const el = boxRef.current
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    setShowJump(!stickToBottom.current)
  }

  const jumpToBottom = () => boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' })

  // auto-scroll when a new message arrives (if at bottom, or it's our own)
  useEffect(() => {
    const mine = messages.at(-1) && sameSender(messages.at(-1), { sender: me })
    if (stickToBottom.current || mine) jumpToBottom()
  }, [lastId]) // eslint-disable-line react-hooks/exhaustive-deps

  // keep position steady when older messages are prepended
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    if (prevHeight.current && !stickToBottom.current) el.scrollTop += el.scrollHeight - prevHeight.current
    prevHeight.current = el.scrollHeight
  }, [messages.length])

  if (loading) {
    return (
      <div className="flex-1 space-y-6 overflow-hidden p-4 sm:p-6">
        {[58, 36, 70, 44, 30, 52].map((w, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
            className={`flex items-end gap-2.5 ${i % 3 === 1 ? 'flex-row-reverse' : ''}`}>
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className={`flex flex-1 flex-col gap-2 ${i % 3 === 1 ? 'items-end' : ''}`}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-11 rounded-[20px]" style={{ width: `${w}%` }} />
            </div>
          </motion.div>
        ))}
      </div>
    )
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={boxRef} onScroll={onScroll} className="scroll-thin h-full overflow-y-auto px-3 pb-6 sm:px-6" aria-live="polite" aria-label="Messages">
        {hasMore && (
          <div className="flex justify-center pt-5">
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} onClick={onLoadOlder} disabled={loadingOlder}
              className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-muted shadow-e1 hover:text-text disabled:opacity-50">
              <History size={13} /> {loadingOlder ? 'Loading…' : 'Load older messages'}
            </motion.button>
          </div>
        )}
        {messages.length === 0 ? <EmptyState /> : (
          <div className="mx-auto max-w-4xl">
            {messages.map((m, i) => (
              <MessageBubble key={m.id} message={m} mine={sameSender(m, { sender: me })} grouped={sameSender(m, messages[i - 1])} onImage={onImage} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showJump && (
          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.8 }}
            onClick={jumpToBottom} aria-label="Jump to latest"
            className="glass absolute bottom-4 left-1/2 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full text-text shadow-e3"
          >
            <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MessageList
