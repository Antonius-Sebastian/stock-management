'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react'
import Joyride, { type Step, type CallBackProps } from 'react-joyride'
import type { UserRole } from '@/lib/rbac'

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
    </TourContext.Provider>
  )
}




