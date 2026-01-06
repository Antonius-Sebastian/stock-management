'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePathname } from 'next/navigation'
import { Search, BookOpen, Video, ListChecks } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSession } from 'next-auth/react'
import {
  getHelpGuideForPage,
  filterTourStepsForRole,
  type HelpGuide,
} from '@/lib/help-content'
import { VideoEmbed } from './video-embed'
import { useTour } from './tour-provider'

interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId?: string
  pagePath?: string
}

export function HelpDialog({
  open,
  onOpenChange,
  pageId,
  pagePath,
}: HelpDialogProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('guide')
  const { startTour } = useTour()

  // Get guide for current page
  const guide = useMemo(() => {
    if (pageId) {
      return getHelpGuideForPage(`/${pageId}`, session?.user?.role as any)
    }
    if (pagePath) {
      return getHelpGuideForPage(pagePath, session?.user?.role as any)
    }
    // Fallback to pathname
    if (pathname) {
      return getHelpGuideForPage(pathname, session?.user?.role as any)
    }
    return null
  }, [pageId, pagePath, pathname, session?.user?.role])

  if (!guide) {
    return null
  }

  // Filter sections based on search and RBAC
  const filteredSections = guide.sections.filter((section) => {
    // RBAC check
    if (section.requiredRole) {
      const userRole = session?.user?.role
      if (
        !userRole ||
        (userRole !== 'ADMIN' && userRole !== section.requiredRole)
      ) {
        return false
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        section.title.toLowerCase().includes(query) ||
        section.content.toLowerCase().includes(query)
      )
    }

    return true
  })

  // Filter tour steps for current role
  const availableTourSteps = filterTourStepsForRole(
    guide.tourSteps,
    session?.user?.role as any
  )

  const handleStartTour = () => {
    if (availableTourSteps.length > 0) {
      startTour(availableTourSteps)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {guide.title}
          </DialogTitle>
          <DialogDescription>{guide.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col space-y-4 overflow-hidden">
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Cari bantuan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Quick Steps Card */}
          {guide.quickSteps.length > 0 && (
            <div className="bg-muted/50 shrink-0 rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Langkah Cepat:</h3>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {guide.quickSteps.map((step, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Content Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="shrink-0">
              <TabsTrigger value="guide">Panduan Lengkap</TabsTrigger>
              {guide.video && (
                <TabsTrigger value="video">Video Tutorial</TabsTrigger>
              )}
              {availableTourSteps.length > 0 && (
                <TabsTrigger value="tour">Tur Interaktif</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="guide" className="mt-4 flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-6 pb-4">
                  {filteredSections.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-muted-foreground">
                        Tidak ada hasil untuk &quot;{searchQuery}&quot;
                      </p>
                    </div>
                  ) : (
                    filteredSections.map((section) => (
                      <div key={section.id} className="space-y-3">
                        <h3 className="text-lg font-semibold">
                          {section.title}
                        </h3>
                        {section.screenshot && (
                          <div className="overflow-hidden rounded-lg border">
                            <img
                              src={section.screenshot}
                              alt={section.title}
                              className="h-auto w-full"
                              onError={(e) => {
                                e.currentTarget.src =
                                  'https://via.placeholder.com/800x600/4F46E5/FFFFFF?text=Screenshot+Placeholder'
                              }}
                            />
                          </div>
                        )}
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {section.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {guide.video && (
              <TabsContent value="video" className="mt-4 flex-1 overflow-auto">
                <VideoEmbed video={guide.video} />
              </TabsContent>
            )}

            {availableTourSteps.length > 0 && (
              <TabsContent value="tour" className="mt-4 flex-1 overflow-auto">
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg border p-6 text-center">
                    <h3 className="mb-2 font-semibold">Tur Interaktif</h3>
                    <p className="text-muted-foreground mb-4 text-sm">
                      Ikuti tur untuk mempelajari fitur-fitur di halaman ini
                      langkah demi langkah.
                    </p>
                    <button
                      onClick={handleStartTour}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium"
                    >
                      Mulai Tur
                    </button>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {availableTourSteps.length} langkah
                    </p>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
