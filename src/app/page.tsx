'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to raw materials page as the default landing page
    router.push('/raw-materials')
  }, [router])

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-lg">Loading...</div>
    </div>
  )
}
