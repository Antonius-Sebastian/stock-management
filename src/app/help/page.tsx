'use client'

import { useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, BookOpen, Video, PlayCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { getHelpGuidesForRole, helpGuides } from '@/lib/help-content'
import { HelpDialog } from '@/components/help/help-dialog'
import { VideoEmbed } from '@/components/help/video-embed'

export default function HelpPage() {
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null)

  // Get guides filtered by role
  const availableGuides = useMemo(() => {
    return getHelpGuidesForRole(session?.user?.role as any)
  }, [session?.user?.role])

  // Filter guides by search query
  const filteredGuides = useMemo(() => {
    if (!searchQuery) return availableGuides

    const query = searchQuery.toLowerCase()
    return availableGuides.filter(
      (guide) =>
        guide.title.toLowerCase().includes(query) ||
        guide.description.toLowerCase().includes(query) ||
        guide.sections.some(
          (s) =>
            s.title.toLowerCase().includes(query) ||
            s.content.toLowerCase().includes(query)
        )
    )
  }, [availableGuides, searchQuery])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          Pusat Bantuan
        </h1>
        <p className="text-muted-foreground">
          Panduan lengkap penggunaan sistem inventory. Pilih topik di bawah
          untuk mempelajari lebih lanjut.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Cari bantuan (contoh: batch, stok, laporan)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Guide Cards */}
      {filteredGuides.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            Tidak ada hasil untuk &quot;{searchQuery}&quot;
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGuides.map((guide) => (
            <Card
              key={guide.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {guide.title}
                </CardTitle>
                <CardDescription>{guide.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Quick Steps Preview */}
                  {guide.quickSteps.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-semibold">
                        Langkah Cepat:
                      </p>
                      <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
                        {guide.quickSteps.slice(0, 2).map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                        {guide.quickSteps.length > 2 && (
                          <li className="text-muted-foreground/70">
                            +{guide.quickSteps.length - 2} langkah lainnya
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Video Preview */}
                  {guide.video && (
                    <div className="bg-muted/50 rounded-lg border p-2">
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Video className="h-3 w-3" />
                        <span>{guide.video.title}</span>
                        <span className="ml-auto">{guide.video.duration}</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => setSelectedGuide(guide.id)}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Buka Panduan
                    </Button>
                    {guide.video && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedGuide(guide.id)
                          // Open video tab (will be handled by dialog)
                        }}
                        title="Tonton Video"
                      >
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="text-muted-foreground flex items-center gap-4 text-xs">
                    <span>{guide.sections.length} panduan</span>
                    {guide.tourSteps.length > 0 && (
                      <span>{guide.tourSteps.length} langkah tur</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Dialog */}
      {selectedGuide && (
        <HelpDialog
          open={!!selectedGuide}
          onOpenChange={(open) => !open && setSelectedGuide(null)}
          pageId={selectedGuide}
        />
      )}
    </div>
  )
}
