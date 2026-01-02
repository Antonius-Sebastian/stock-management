'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditableCellProps {
  value: number | string
  isEditable: boolean
  onSave: (newValue: number) => Promise<void>
  onDelete?: () => Promise<void>
  className?: string
}

export function EditableCell({
  value,
  isEditable,
  onSave,
  onDelete,
  className,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const numericValue = typeof value === 'number' ? value : 0
  const hasValue = numericValue > 0

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleClick = () => {
    if (!isEditable) return
    setEditValue(numericValue.toString())
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue('')
  }

  const handleSave = async () => {
    if (!editValue.trim()) {
      handleCancel()
      return
    }

    const newValue = parseFloat(editValue)
    if (isNaN(newValue) || newValue < 0) {
      handleCancel()
      return
    }

    setIsLoading(true)
    try {
      await onSave(newValue)
      setIsEditing(false)
      setEditValue('')
    } catch (error) {
      console.error('Error saving value:', error)
      // Keep editing mode open on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleBlur = () => {
    // Cancel on blur - user must press Enter to save
    if (isEditing && !isLoading) {
      handleCancel()
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    if (!confirm('Delete this movement? This action cannot be undone.')) {
      return
    }

    setIsLoading(true)
    try {
      await onDelete()
    } catch (error) {
      console.error('Error deleting:', error)
    } finally {
      setIsLoading(false)
      setShowDelete(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-2">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      </div>
    )
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onInput={(e) => {
          const target = e.target as HTMLInputElement
          if (parseFloat(target.value) < 0) {
            target.value = '0'
            setEditValue('0')
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          'h-full w-full px-2 py-1 text-center',
          'border-primary bg-background rounded border',
          'focus:ring-primary/20 focus:ring-2 focus:outline-none',
          'box-border', // Ensure border is included in dimensions
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'group relative h-full',
        isEditable && 'hover:bg-muted/50 cursor-pointer',
        className
      )}
      onClick={handleClick}
      onMouseEnter={() => hasValue && onDelete && setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <div className="flex h-full items-center justify-center px-2 py-1 text-center">
        {hasValue ? numericValue.toLocaleString() : '-'}
      </div>

      {showDelete && onDelete && hasValue && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDelete()
          }}
          className={cn(
            'absolute top-1/2 right-1 -translate-y-1/2',
            'bg-destructive/10 hover:bg-destructive/20 rounded p-1',
            'opacity-0 transition-opacity group-hover:opacity-100'
          )}
          title="Delete movements"
        >
          <Trash2 className="text-destructive h-3 w-3" />
        </button>
      )}
    </div>
  )
}
