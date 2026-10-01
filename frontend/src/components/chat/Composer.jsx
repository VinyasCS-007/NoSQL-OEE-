import { ImagePlus, Loader2, Lock, Reply, SendHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'

const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Composer: auto-growing textarea, reply chip, image attach (members only), and a send
 * button you can tap or pull upward past 40px to launch the message.
 */
export default function Composer({ isMember, disabled, reply, onClearReply, onSend, onUpload, onTyping, focusKey }) {
  const { buzz, toast } = useSettings()
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const area = useRef(null), box = useRef(null), fileRef = useRef(null)
  const pull = useRef(null), pulled = useRef(false)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => { if (focusKey) area.current?.focus() }, [focusKey])

  const grow = () => { const el = area.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(144, el.scrollHeight) + 'px' } }
  const shake = () => {
    box.current?.animate([{ translate: '0' }, { translate: '-9px' }, { translate: '9px' }, { translate: '-5px' }, { translate: '5px' }, { translate: '0' }], { duration: 420 })
    buzz([20, 40, 20])
  }

  const pick = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    // quick client-side check; the server validates and re-encodes again
    if (!TYPES.includes(f.type)) return toast('Only JPEG, PNG or WebP images')
    if (f.size > MAX_BYTES) return toast('Image must be 5 MB or smaller')
    setFile(f)
  }

  const send = async (viaPull) => {
    const t = text.trim()
    if (busy) return
    if (!t && !file) return shake()
    if (disabled) return toast('Not connected yet, try again in a moment')
    setBusy(true)
    try {
      let image_file_id
      if (file) image_file_id = (await onUpload(file)).file_id
      if (onSend({ text: t, image_file_id, reply_to: reply?.id })) {
        setText(''); setFile(null); onClearReply()
        requestAnimationFrame(grow)
        buzz(viaPull ? [18, 30, 30] : [12, 40, 18])
      } else toast('Not connected, try again in a moment')
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  // pull-to-send
  const onPDown = (e) => { pull.current = { x0: e.clientX, y0: e.clientY, armed: false, moved: 0 }; try { e.currentTarget.setPointerCapture(e.pointerId) } catch {} }
  const onPMove = (e) => {
    const p = pull.current
    if (!p) return
    const dy = e.clientY - p.y0
    p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x0, dy))
    const v = Math.max(0, -dy), ev = v > 60 ? 60 + (v - 60) * 0.3 : v
    e.currentTarget.style.transition = 'none'
    e.currentTarget.style.transform = `translateY(${-ev}px) scale(${1 + ev / 260}) rotate(${-ev / 4}deg)`
    if (v > 40 && !p.armed) { p.armed = true; buzz(12) } else if (v <= 40) p.armed = false
  }
  const onPUp = (e) => {
    const p = pull.current
    if (!p) return
    e.currentTarget.style.transition = 'transform .5s cubic-bezier(.34,1.56,.64,1)'
    e.currentTarget.style.transform = 'none'
    pulled.current = true
    if (p.armed || p.moved < 6) send(p.armed)
    pull.current = null
  }

  const canSend = !!(text.trim() || file)
  return (
    <div className="border-t border-border px-[clamp(10px,2vw,16px)] pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5">
      {reply && (
        <div className="mb-2 flex items-center gap-2.5 rounded-[14px] bg-accent-soft py-2 pl-3 pr-2 animate-[popIn_.3s_both]">
          <Reply size={16} strokeWidth={2.2} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1 text-[13px]">
            <span className="font-semibold text-accent">Replying to {reply.alias}</span>
            <div className="truncate text-muted">{reply.text || 'Picture'}</div>
          </div>
          <button type="button" onClick={onClearReply} aria-label="Cancel reply" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-surface-solid text-text"><X size={14} /></button>
        </div>
      )}
      {preview && (
        <div className="relative mb-2 inline-block animate-[popIn_.3s_both]">
          <img src={preview} alt="Selected" className="h-24 rounded-2xl border border-border object-cover shadow-e2" />
          <button type="button" onClick={() => setFile(null)} aria-label="Remove image" className="absolute -right-2 -top-2 grid h-7 w-7 cursor-pointer place-items-center rounded-full border-0 bg-text text-bg shadow-e2"><X size={14} /></button>
        </div>
      )}
      <div ref={box} className="flex items-end gap-1.5 rounded-3xl border border-border bg-surface-2 p-1.5">
        <input ref={fileRef} type="file" accept={TYPES.join(',')} className="hidden" onChange={pick} />
        <button type="button" data-ripple="" aria-label={isMember ? 'Attach picture' : 'Picture sharing is for members'}
          onClick={() => { if (isMember) fileRef.current?.click(); else { toast('Register to share pictures. Guests can only view them.'); buzz([30, 60, 30]) } }}
          className="springy relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border-0 bg-transparent text-muted hover:text-accent active:scale-[.88]">
          {isMember ? <ImagePlus size={20} /> : <Lock size={17} />}
        </button>
        <textarea ref={area} rows={1} value={text} maxLength={2000} aria-label="Message"
          placeholder={disabled ? 'Connecting…' : 'Write a message…'}
          onChange={(e) => { setText(e.target.value); grow(); if (e.target.value) onTyping?.() }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(false) } }}
          className="max-h-36 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-[11px] text-base leading-[1.4] outline-none" />
        <button type="button" data-ripple="light" aria-label="Send"
          onPointerDown={onPDown} onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp}
          onClick={() => { if (pulled.current) { pulled.current = false; return } send(false) }}
          className={`bg-brand relative grid h-11 w-11 shrink-0 cursor-pointer touch-none place-items-center overflow-hidden rounded-full border-0 text-white shadow-[0_8px_20px_-8px_var(--glow)] transition-opacity ${canSend ? '' : 'opacity-50'}`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} strokeWidth={2.2} />}
        </button>
      </div>
      <div className="px-2 pt-2 text-xs text-muted [text-wrap:pretty]">Swipe a message to reply. Pull the send button up to launch it.</div>
    </div>
  )
}
