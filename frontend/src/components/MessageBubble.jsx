import { motion } from 'framer-motion'
import { Maximize2 } from 'lucide-react'
import { useState } from 'react'
import { imageUrl } from '../lib/api'
import { RoleBadge } from './ui'

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// deterministic hue per alias, so each person gets a consistent avatar colour
const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

/**
 * Round initials avatar. The gradient colour is derived from the alias, so each person keeps a consistent colour.
 * @category Display
 */
export function Avatar({ alias, size = 32 }) {
  const h = hue(alias)
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full text-[11px] font-bold text-white shadow-e1 ring-2 ring-bg"
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${h} 80% 62%), hsl(${(h + 50) % 360} 75% 48%))` }}
      aria-hidden
    >
      {alias.slice(0, 2).toUpperCase()}
    </span>
  )
}

/**
 * One chat message: avatar, alias with a guest/member badge, a text and/or image bubble, and the time on hover. `mine` right-aligns it with the brand gradient; `grouped` hides the header for consecutive messages from the same sender.
 * @category Chat
 */
export function MessageBubble({ message, mine, grouped, onImage }) {
  const { sender, text, image_file_id, created_at } = message
  const [loaded, setLoaded] = useState(false)

  return (
    <motion.div
      layout="position"
      // bubbles swing up into place from a slight 3D tilt
      initial={{ opacity: 0, y: 18, rotateX: -35, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.7 }}
      style={{ transformOrigin: mine ? 'bottom right' : 'bottom left', transformPerspective: 800 }}
      className={`group flex items-end gap-2.5 ${mine ? 'flex-row-reverse' : ''} ${grouped ? 'mt-1' : 'mt-5'}`}
    >
      <div className="w-8 shrink-0">{!grouped && !mine && <Avatar alias={sender.alias} />}</div>

      <div className={`flex min-w-0 max-w-[82%] flex-col sm:max-w-[68%] ${mine ? 'items-end' : 'items-start'}`}>
        {!grouped && (
          <div className={`mb-1.5 flex items-center gap-2 px-1 text-xs ${mine ? 'flex-row-reverse' : ''}`}>
            <span className="font-semibold text-text">{mine ? 'You' : sender.alias}</span>
            <RoleBadge type={sender.type} />
          </div>
        )}

        <motion.div
          whileHover={{ y: -1 }}
          className={`relative overflow-hidden text-[14.5px] leading-relaxed transition-shadow duration-300
            ${mine
              ? 'rounded-[20px] rounded-br-md bg-brand text-on-accent shadow-[0_10px_28px_-12px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.22)]'
              : 'glass rounded-[20px] rounded-bl-md text-text shadow-e2'}`}
        >
          {image_file_id && (
            <button onClick={() => onImage(imageUrl(image_file_id))} className="group/img relative block w-full" aria-label="Open image">
              {!loaded && <div className="shimmer h-48 w-64 max-w-full" />}
              <img
                src={imageUrl(image_file_id)}
                alt={`Shared by ${sender.alias}`}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                className={`max-h-80 w-full object-cover transition duration-500 group-hover/img:scale-[1.03] ${loaded ? 'opacity-100 blur-0' : 'absolute inset-0 opacity-0 blur-md'}`}
              />
              <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition group-hover/img:opacity-100">
                <Maximize2 size={14} />
              </span>
            </button>
          )}
          {text && <p className="whitespace-pre-wrap break-words px-4 py-2.5">{text}</p>}
        </motion.div>

        <span className="mt-1 px-1 text-[10.5px] text-muted opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {time(created_at)}
        </span>
      </div>
    </motion.div>
  )
}

export default MessageBubble
