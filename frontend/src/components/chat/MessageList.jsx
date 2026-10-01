import { Reply } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { imageUrl } from '../../lib/api'
import { timeOf } from '../../lib/format'
import { useSettings } from '../../hooks/useSettings'
import { Avatar, RoleBadge, TypingDots } from '../ui'

/**
 * Message list with grouping, image previews and swipe-to-reply
 * (drag a bubble sideways past 64px and let go).
 */
export default function MessageList({ messages, me, loading, hasMore, loadingOlder, onLoadOlder, onReply, onImage, typing }) {
  const list = useRef(null)
  const swipe = useRef(null)
  const { buzz } = useSettings()

  // stick to the bottom for new messages; keep the reading position when older ones are prepended
  const prev = useRef({ first: null, last: null, h: 0 })
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const first = messages[0]?.id, last = messages.at(-1)?.id, p = prev.current
    if (p.last && last === p.last && first !== p.first) el.scrollTop += el.scrollHeight - p.h
    else el.scrollTo({ top: el.scrollHeight, behavior: p.last ? 'smooth' : 'auto' })
    prev.current = { first, last, h: el.scrollHeight }
  }, [messages, typing])

  const icon = (el) => el.parentElement?.querySelector('[data-swipe-icon]')
  const onDown = (e) => {
    const el = e.target.closest('[data-swipe]')
    if (el) swipe.current = { el, x0: e.clientX, y0: e.clientY, lock: null, armed: false, dir: el.dataset.mine === '1' ? -1 : 1, id: el.dataset.swipe }
  }
  const onMove = (e) => {
    const s = swipe.current
    if (!s) return
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0
    if (s.lock === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (s.lock !== 'x') return
    let v = Math.max(0, dx * s.dir)
    v = v > 80 ? 80 + (v - 80) * 0.25 : v // rubber band
    s.el.style.transition = 'none'
    s.el.style.transform = `translateX(${v * s.dir}px)`
    const ic = icon(s.el)
    if (ic) { ic.style.opacity = String(Math.min(1, v / 64)); ic.style.transform = `scale(${0.5 + Math.min(0.6, v / 110)})` }
    if (v >= 64 && !s.armed) { s.armed = true; buzz(15) } else if (v < 64) s.armed = false
  }
  const onUp = () => {
    const s = swipe.current
    if (!s) return
    s.el.style.transition = 'transform .55s cubic-bezier(.34,1.56,.64,1)'
    s.el.style.transform = 'translateX(0px)'
    const ic = icon(s.el)
    if (ic) { ic.style.opacity = '0'; ic.style.transform = 'scale(.5)' }
    if (s.armed) { const m = messages.find((x) => x.id === s.id); m && onReply(m) }
    swipe.current = null
  }

  useEffect(() => () => { swipe.current = null }, [])

  return (
    <div ref={list} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      className="scroll-thin flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-[clamp(12px,3vw,28px)] pb-5 pt-2">
      {hasMore && (
        <button type="button" onClick={onLoadOlder} disabled={loadingOlder}
          className="springy mx-auto my-2 h-9 cursor-pointer rounded-full border border-border bg-surface-2 px-4 text-[13px] font-semibold text-text disabled:opacity-60">
          {loadingOlder ? 'Loading…' : 'Load older messages'}
        </button>
      )}
      {loading && [0, 1, 2, 3].map((i) => (
        <div key={i} className={`mt-[18px] flex items-end gap-2.5 ${i % 2 ? 'flex-row-reverse' : ''}`}>
          <div className="h-[34px] w-[34px] animate-pulse rounded-xl bg-surface-2" />
          <div className="h-11 animate-pulse rounded-[20px] bg-surface-2" style={{ width: `${30 + ((i * 17) % 30)}%` }} />
        </div>
      ))}
      {!loading && messages.length === 0 && (
        <div className="m-auto flex flex-col items-center gap-2.5 py-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-[22px_22px_22px_8px] bg-accent-soft"><TypingDots size={7} color="bg-accent" /></div>
          <div className="text-lg font-semibold">Nothing here yet</div>
          <div className="text-[15px] text-muted">Be the first to say something.</div>
        </div>
      )}
      {messages.map((m, i) => {
        const mine = m.sender.alias === me.alias && m.sender.type === me.type
        const prev = messages[i - 1]
        const grouped = !!prev && prev.sender.alias === m.sender.alias && prev.sender.type === m.sender.type
        const body = (
          <>
            {m.reply && (
              <div className={`mb-1.5 rounded-md border-l-[3px] px-2.5 py-1.5 text-[13px] ${mine ? 'border-white/70 bg-white/[.16]' : 'border-accent bg-accent-soft'}`}>
                <div className={`font-semibold ${mine ? '' : 'text-accent'}`}>{m.reply.alias === me.alias ? 'You' : m.reply.alias}</div>
                <div className={`max-w-[280px] truncate ${mine ? 'opacity-85' : 'text-muted'}`}>{m.reply.text || 'Picture'}</div>
              </div>
            )}
            {m.reply_to && !m.reply && <div className="mb-1.5 text-[12px] italic opacity-70">Original message expired</div>}
            {m.image_file_id && (
              <button type="button" onClick={() => onImage(imageUrl(m.image_file_id))} className="mb-1 block cursor-zoom-in border-0 bg-transparent p-0">
                <img src={imageUrl(m.image_file_id)} alt="Shared" loading="lazy" draggable={false} className="max-h-64 max-w-full rounded-[14px] object-cover" />
              </button>
            )}
            {m.text}
          </>
        )
        const swipeIcon = (side) => (
          <div data-swipe-icon="" className={`pointer-events-none absolute top-1/2 -mt-[15px] grid h-[30px] w-[30px] place-items-center rounded-full bg-accent-soft text-accent opacity-0 [transform:scale(.5)] ${side}`}>
            <Reply size={15} strokeWidth={2.2} />
          </div>
        )
        return mine ? (
          <div key={m.id} className={`flex origin-bottom-right flex-col items-end gap-[5px] animate-[msgIn_.5s_cubic-bezier(.22,1,.36,1)_both] ${grouped ? 'mt-1' : 'mt-[18px]'}`}>
            {!grouped && <div className="pr-1 text-xs text-muted">You · {timeOf(m.created_at)}</div>}
            <div className="relative max-w-[min(560px,80%)]">
              {swipeIcon('right-1.5')}
              <div data-swipe={m.id} data-mine="1"
                className="bg-brand relative cursor-grab select-none rounded-[20px_6px_20px_20px] px-3.5 py-2.5 text-[15px] leading-[1.45] text-white shadow-[0_10px_24px_-12px_var(--glow)] [overflow-wrap:anywhere] [touch-action:pan-y]">
                {body}
              </div>
            </div>
          </div>
        ) : (
          <div key={m.id} className={`flex origin-bottom-left items-end gap-2.5 animate-[msgIn_.5s_cubic-bezier(.22,1,.36,1)_both] ${grouped ? 'mt-1' : 'mt-[18px]'}`}>
            <div className="w-[34px] shrink-0">{!grouped && <Avatar alias={m.sender.alias} size={34} radius={12} />}</div>
            <div className="flex min-w-0 max-w-[min(560px,80%)] flex-col items-start gap-[5px]">
              {!grouped && (
                <div className="flex items-center gap-[7px] pl-0.5 text-[13px] font-semibold">
                  {m.sender.alias}<RoleBadge type={m.sender.type} /><span className="text-xs font-normal text-muted">{timeOf(m.created_at)}</span>
                </div>
              )}
              <div className="relative">
                {swipeIcon('left-1.5')}
                <div data-swipe={m.id} data-mine="0"
                  className="relative cursor-grab select-none rounded-[6px_20px_20px_20px] border border-border bg-surface-solid px-3.5 py-2.5 text-[15px] leading-[1.45] shadow-e1 [overflow-wrap:anywhere] [touch-action:pan-y]">
                  {body}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      {typing && (
        <div className="mt-[18px] flex items-center gap-2.5 animate-[fadeIn_.3s_both]">
          <Avatar alias={typing} size={34} radius={12} />
          <div className="rounded-[6px_20px_20px_20px] border border-border bg-surface-solid px-[15px] py-[13px]"><TypingDots /></div>
          <span className="text-xs text-muted">{typing} is typing</span>
        </div>
      )}
    </div>
  )
}
