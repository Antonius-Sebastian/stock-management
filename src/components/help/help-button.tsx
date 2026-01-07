'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'
import { HelpDialog } from './help-dialog'
import { usePathname } from 'next/navigation'

interface HelpButtonProps {
  pageId?: string
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * Contextual Help Button Component
 * Opens help dialog for the current page
 */
export function HelpButton({
  pageId,
  className,
  variant = 'outline',
  size = 'icon',
}: HelpButtonProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Extract page ID from pathname if not provided
  const currentPageId = pageId || pathname?.replace('/', '') || ''

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={className}
        title="Bantuan"
        aria-label="Buka bantuan"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      <HelpDialog
        open={open}
        onOpenChange={setOpen}
        pageId={currentPageId}
        pagePath={pathname}
      />
    </>
  )
}



