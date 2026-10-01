import { Download, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

/**
 * Full-screen image viewer with a 3D zoom-in, an open-original link and Escape to close.
 * Renders nothing when `src` is null.
 */
export default function Lightbox({ src, onClose }) {
  const img = useRef(null)
  useEffect(() => {
    if (!src) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    img.current?.animate(
      [{ opacity: 0, transform: 'perspective(1200px) translateY(40px) rotateX(18deg) scale(.8)' }, { opacity: 1, transform: 'none' }],
      { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' })
    return () => removeEventListener('keydown', onKey)
  }, [src, onClose])

  if (!src) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="Image preview" onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-xl animate-[fadeIn_.25s_both]">
      <div className="absolute right-4 top-4 flex gap-2">
        <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Open original"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/20">
          <Download size={18} />
        </a>
        <button type="button" autoFocus onClick={onClose} aria-label="Close preview"
          className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border-0 bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition-transform hover:rotate-90 hover:bg-white/20">
          <X size={20} />
        </button>
      </div>
      <img ref={img} src={src} alt="Full size" onClick={(e) => e.stopPropagation()}
        className="max-h-[86vh] max-w-full rounded-3xl object-contain shadow-[0_40px_120px_-20px_rgb(0_0_0/.8)] ring-1 ring-white/10" />
    </div>
  )
}
