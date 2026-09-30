import { useCallback, useEffect, useRef, useState } from 'react'
import { WS_URL } from '../lib/api'

/**
 * Opens a WebSocket for one room and reconnects with backoff if it drops.
 * status: 'connecting' | 'open' | 'closed'
 */
export function useChatSocket(roomId, token, { onMessage, onError, onUnauthorized }) {
  const [status, setStatus] = useState('connecting')
  const wsRef = useRef(null)
  const handlers = useRef({ onMessage, onError, onUnauthorized })
  handlers.current = { onMessage, onError, onUnauthorized }

  useEffect(() => {
    if (!roomId || !token) return
    let stopped = false
    let retry = 0
    let timer

    const open = () => {
      setStatus('connecting')
      const ws = new WebSocket(`${WS_URL}/ws/${roomId}?token=${encodeURIComponent(token)}`)
      wsRef.current = ws
      ws.onopen = () => { retry = 0; setStatus('open') }
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.type === 'message') handlers.current.onMessage?.(data.message)
        else if (data.type === 'error') handlers.current.onError?.(data.detail)
      }
      ws.onclose = (e) => {
        setStatus('closed')
        if (stopped) return
        if (e.code === 4401) return handlers.current.onUnauthorized?.()
        if (e.code === 4404) return
        // exponential backoff: 0.5s, 1s, 2s ... max 8s
        timer = setTimeout(open, Math.min(8000, 500 * 2 ** retry++))
      }
    }
    open()

    return () => {
      stopped = true
      clearTimeout(timer)
      wsRef.current?.close()
    }
  }, [roomId, token])

  const send = useCallback((payload) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
      return true
    }
    return false
  }, [])

  return { status, send }
}
