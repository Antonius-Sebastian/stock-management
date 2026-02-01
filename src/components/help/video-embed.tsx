'use client'

import { useState } from 'react'
import { Play, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { HelpVideo } from '@/lib/help-content'

interface VideoEmbedProps {
  video: HelpVideo
  className?: string
}

/**
 * YouTube Video Embed Component
 * Lazy loads video and shows placeholder until clicked
 */
export function VideoEmbed({ video, className }: VideoEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handlePlay = () => {
    setIsLoading(true)
    setIsPlaying(true)
  }

  const youtubeEmbedUrl = `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`
  const youtubeWatchUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`

  // Placeholder thumbnail (in production, use YouTube thumbnail API)
  const thumbnailUrl = `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`

  return (
    <Card className={className}>
      <CardContent className="p-0">
        {!isPlaying ? (
          <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-lg">
            {/* Thumbnail */}
            <img
              src={thumbnailUrl}
              alt={video.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                // Fallback to placeholder if thumbnail fails
                e.currentTarget.src =
                  'https://via.placeholder.com/800x450/4F46E5/FFFFFF?text=Video+Placeholder'
              }}
            />

            {/* Overlay with play button */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors hover:bg-black/50">
              <div className="text-center">
                <Button
                  size="lg"
                  onClick={handlePlay}
                  className="mb-2 h-16 w-16 rounded-full"
                  disabled={isLoading}
                >
                  <Play className="ml-1 h-8 w-8 fill-current" />
                </Button>
                <p className="text-sm font-medium text-white">{video.title}</p>
                <p className="text-xs text-white/80">{video.duration}</p>
              </div>
            </div>

            {/* Coming Soon Badge (for dummy videos) */}
            {video.youtubeId === 'dQw4w9WgXcQ' && (
              <div className="absolute top-2 right-2 rounded bg-yellow-500 px-2 py-1 text-xs font-semibold text-white">
                Coming Soon
              </div>
            )}
          </div>
        ) : (
          <div className="relative aspect-video w-full">
            {isLoading && (
              <div className="bg-muted absolute inset-0 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Memuat video...</p>
              </div>
            )}
            <iframe
              src={youtubeEmbedUrl}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full rounded-lg"
              onLoad={() => setIsLoading(false)}
            />
          </div>
        )}

        {/* Video Info */}
        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold">{video.title}</h3>
              <p className="text-muted-foreground text-sm">
                {video.description}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Durasi: {video.duration}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="shrink-0"
              title="Buka di YouTube"
            >
              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}



