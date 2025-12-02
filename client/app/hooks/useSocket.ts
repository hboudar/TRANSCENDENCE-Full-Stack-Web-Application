'use client'
import { useEffect, useState } from 'react'
import socket from '../socket'
import type { Socket } from 'socket.io-client'

/**
 * Hook that ensures socket is available and ready on client-side
 * Returns null until socket is initialized
 */
export function useSocket(): Socket | null {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Socket is initialized on client-side, so we're ready
    setIsReady(true)
  }, [])

  if (!isReady || !socket) {
    return null
  }

  return socket
}
