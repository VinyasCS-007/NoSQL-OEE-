import { AnimatePresence, motion } from 'framer-motion'
import { ImagePlus, Loader2, Lock, SendHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Floating glass composer dock. */
export default function InputBar({ isMember, disabled, onSend, onUpload }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [focused, setFocused] = useState(false)
  const fileRef = useRef(null)
  const areaRef = useRef(null)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // grow the textarea with its content (up to max-h)
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const pick = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    // quick client-side check; the server validates again
    if (!TYPES.includes(f.type)) return setError('Only JPEG, PNG or WebP images')
    if (f.size > MAX_BYTES) return setError('Image must be 5 MB or smaller')
    setError('')
    setFile(f)
  }

  const canSend = !disabled && !busy && (text.trim() || file)

  const submit = async (e) => {
    e.preventDefault()
    if (!canSend) return
    setBusy(true)
    setError('')
    try {
      let image_file_id
      if (file) image_file_id = (await onUpload(file)).file_id
      if (onSend({ text: text.trim(), image_file_id })) {
        setText('')
        setFile(null)
      } else setError('Not connected, try again in a moment')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="px-3 pb-3 pt-1 sm:px-6 sm:pb-5">
      <div className="mx-auto max-w-4xl">
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              className="mb-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger" role="alert">
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div
          animate={{ boxShadow: focused ? '0 0 0 4px var(--accent-soft), 0 24px 60px -24px var(--glow)' : 'var(--shadow-2)' }}
          transition={{ duration: 0.25 }}
          className={`glass rounded-[26px] p-2 transition-colors ${focused ? 'border-accent/50' : ''}`}
        >
          <AnimatePresence>
            {preview && (
              <motion.div
                initial={{ opacity: 0, height: 0, rotateX: -40 }} animate={{ opacity: 1, height: 'auto', rotateX: 0 }} exit={{ opacity: 0, height: 0 }}
                className="px-2 pb-2 pt-1 perspective-[600px]"
              >
                <div className="relative inline-block">
                  <img src={preview} alt="Selected" className="h-24 rounded-2xl border border-border object-cover shadow-e2" />
                  <motion.button whileHover={{ scale: 1.1, rotate: 90 }} type="button" onClick={() => setFile(null)} aria-label="Remove image"
                    className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-text text-bg shadow-e2">
                    <X size={14} />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-1.5">
            <input ref={fileRef} type="file" accept={TYPES.join(',')} className="hidden" onChange={pick} />
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => (isMember ? fileRef.current?.click() : setError('Register to share pictures — guests can only view them'))}
              aria-label={isMember ? 'Attach image' : 'Image upload is for members only'}
              title={isMember ? 'Attach image' : 'Members only'}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors hover:bg-surface-2 ${isMember ? 'text-muted hover:text-accent' : 'text-muted/50'}`}
            >
              {isMember ? <ImagePlus size={20} /> : <Lock size={17} />}
            </motion.button>

            <textarea
              ref={areaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter adds a new line
                if (e.key === 'Enter' && !e.shiftKey) submit(e)
              }}
              rows={1}
              maxLength={2000}
              placeholder={disabled ? 'Connecting…' : 'Write a message…'}
              aria-label="Message"
              className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-[14.5px] text-text outline-none placeholder:text-muted/70"
            />

            {text.length > 1800 && <span className="self-center text-[11px] tabular-nums text-muted">{2000 - text.length}</span>}

            <motion.button
              whileTap={{ scale: 0.88 }}
              whileHover={canSend ? { scale: 1.06, rotate: -8 } : {}}
              animate={{ opacity: canSend ? 1 : 0.45, scale: canSend ? 1 : 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              disabled={!canSend}
              aria-label="Send message"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-on-accent shadow-[0_10px_24px_-8px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.25)]"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
            </motion.button>
          </div>
        </motion.div>
        <p className="mt-2 hidden text-center text-[11px] text-muted sm:block">
          <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> to send · <kbd className="rounded border border-border px-1 font-mono">Shift + Enter</kbd> for a new line
        </p>
      </div>
    </form>
  )
}
