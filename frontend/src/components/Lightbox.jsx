import { AnimatePresence, motion } from 'framer-motion'
import { Download, X } from 'lucide-react'
import { useEffect } from 'react'

/**
 * Full-screen image viewer with a 3D zoom-in, drag-to-wiggle, an open-original link and Escape to close. Renders nothing when `src` is null.
 * @category Overlays
 */
export function Lightbox({ src, onClose }) {
  useEffect(() => {
    if (!src) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-xl perspective-[1200px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div className="absolute right-4 top-4 flex gap-2">
            <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Open original"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20">
              <Download size={18} />
            </a>
            <motion.button autoFocus whileHover={{ rotate: 90 }} onClick={onClose} aria-label="Close preview"
              className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20">
              <X size={20} />
            </motion.button>
          </div>
          <motion.img
            src={src}
            alt="Full size"
            className="max-h-[86vh] max-w-full rounded-3xl object-contain shadow-[0_40px_120px_-20px_rgb(0_0_0/0.8)] ring-1 ring-white/10"
            initial={{ scale: 0.8, opacity: 0, rotateX: 18, y: 40 }}
            animate={{ scale: 1, opacity: 1, rotateX: 0, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, rotateX: -12, y: 30 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            drag
            dragSnapToOrigin
            dragElastic={0.2}
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default Lightbox
