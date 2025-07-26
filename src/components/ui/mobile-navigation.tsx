import { MenuIcon, X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const MobileNavigationButton: React.FC<{
  isOpen: boolean
  onToggle: () => void
  className?: string
}> = ({ isOpen, onToggle, className }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-2 text-slate-100 hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500',
        'h-11 w-11', // 44px minimum touch target
        className,
      )}
      aria-expanded={isOpen}
      aria-label="Toggle navigation menu"
    >
      {isOpen
        ? (
          <X className="h-6 w-6" aria-hidden="true"/>
          )
        : (
          <MenuIcon className="h-6 w-6" aria-hidden="true"/>
          )}
    </button>
  )
}

export const MobileNavigationDrawer: React.FC<{
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}> = ({ isOpen, onClose, children }) => {
  // Close drawer when clicking backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Close drawer on Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent scroll when drawer is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }

    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-80 max-w-[90vw] bg-slate-800/95 backdrop-blur-lg border-r border-slate-700 shadow-2xl transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-slate-100 geist-font">
              Menu
            </h2>
            <MobileNavigationButton
              isOpen={true}
              onToggle={onClose}
              className="text-slate-100 hover:bg-slate-700/50"
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

export const MobileNavigationSection: React.FC<{
  title: string
  children: React.ReactNode
}> = ({ title, children }) => {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3 geist-font">
        {title}
      </h3>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  )
}

export const MobileNavigationItem: React.FC<{
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  shortcut?: string
}> = ({ children, onClick, disabled, shortcut }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full text-left px-3 py-3 rounded-md text-sm font-medium transition-colors', // 44px minimum height
        'flex items-center justify-between',
        disabled
          ? 'text-slate-500 cursor-not-allowed'
          : 'text-slate-100 hover:bg-slate-700/50 focus:bg-slate-700/50 focus:outline-none',
      )}
    >
      <span>{children}</span>
      {shortcut && (
        <span className="text-xs text-slate-400 font-mono">
          {shortcut}
        </span>
      )}
    </button>
  )
}

export const MobileNavigationSeparator: React.FC = () => {
  return <div className="my-2 border-t border-slate-700"/>
}
