'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to raw materials page as the default landing page
    router.push('/raw-materials')
  }, [router])

  return (
    <div className="flex h-64 flex-col items-center justify-center space-y-4">
      <div className="relative">
        <Loader2 className="text-primary h-12 w-12 animate-spin transition-opacity duration-300" />
        <Loader2
          className="text-primary/50 absolute inset-0 h-12 w-12 animate-spin transition-opacity duration-300"
          style={{
            animationDirection: 'reverse',
            animationDuration: '1.5s',
          }}
        />
      </div>
      <p className="text-muted-foreground animate-pulse text-sm font-medium">
        Memuat...
      </p>
    </div>
  )
}
