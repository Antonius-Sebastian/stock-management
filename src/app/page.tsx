"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to raw materials page as the default landing page
    router.push("/raw-materials")
  }, [router])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-lg">Loading...</div>
    </div>
  )
}
