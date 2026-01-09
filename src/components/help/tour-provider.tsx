'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'
import dynamic from 'next/dynamic'
import type { Step, CallBackProps } from 'react-joyride'
import type { UserRole } from '@/lib/rbac'

// Dynamically import Joyride with SSR disabled to prevent hydration errors
const Joyride = dynamic(
  () => import('react-joyride').then((mod) => mod.default),
  { ssr: false }
)

interface TourContextType {
  startTour: (steps: Step[]) => void
  isRunning: boolean
}

const TourContext = createContext<TourContextType | undefined>(undefined)

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour must be used within TourProvider')
  }
  return context
}

interface TourProviderProps {
  children: ReactNode
}

export function TourProvider({ children }: TourProviderProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const startTour = useCallback((newSteps: Step[]) => {
    setSteps(newSteps)
    setIsRunning(true)
  }, [])

  const handleTourCallback = (data: CallBackProps) => {
    const { status } = data

    if (status === 'finished' || status === 'skipped') {
      setIsRunning(false)
      setSteps([])
    }
  }

  return (
    <TourContext.Provider value={{ startTour, isRunning }}>
      {children}
      {isMounted && (
        <Joyride
          steps={steps}
          run={isRunning}
          continuous
          showProgress
          showSkipButton
          callback={handleTourCallback}
          styles={{
            options: {
              primaryColor: 'hsl(var(--primary))',
              textColor: 'hsl(var(--foreground))',
              backgroundColor: 'hsl(var(--background))',
              overlayColor: 'rgba(0, 0, 0, 0.5)',
              arrowColor: 'hsl(var(--background))',
            },
          }}
          locale={{
            back: 'Kembali',
            close: 'Tutup',
            last: 'Selesai',
            next: 'Lanjut',
            open: 'Buka dialog',
            skip: 'Lewati',
          }}
        />
      )}
    </TourContext.Provider>
  )
}
