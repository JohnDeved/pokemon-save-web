import * as SliderPrimitive from '@radix-ui/react-slider'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Slider = ({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbVisibleOnHover = true,
  maxVisualValue,
  disabled,
  onValueChange,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbVisibleOnHover?: boolean
  maxVisualValue?: number
}) => {
  const sliderRef = React.useRef<HTMLDivElement>(null)

  // Fix nested ternary
  let _values: number[]
  if (Array.isArray(value)) {
    _values = value
  } else if (Array.isArray(defaultValue)) {
    _values = defaultValue
  } else {
    _values = [min, max]
  }

  const handleWheel = React.useCallback(
    (e: WheelEvent) => {
      if (typeof value === 'undefined' || !Array.isArray(value)) return
      if (disabled) return
      e.preventDefault()
      const delta = Math.sign(e.deltaY) * (e.shiftKey ? 10 : 1)
      // Clamp to maxVisualValue if provided
      const upperLimit = typeof maxVisualValue === 'number' ? Math.min(max, maxVisualValue) : max
      const newValue = Math.max(min, Math.min(upperLimit, value[0]! - delta))
      if (onValueChange) {
        onValueChange([newValue])
      }
    },
    [value, disabled, onValueChange, max, maxVisualValue, min]
  )

  React.useEffect(() => {
    const sliderEl = sliderRef.current
    if (!sliderEl) return
    sliderEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      sliderEl.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  // Calculate percentage for the visual max
  const visualPercent = typeof maxVisualValue === 'number' && maxVisualValue > min && max > min ? ((maxVisualValue - min) / (max - min)) * 100 : 100

  // Clamp controlled value to maxVisualValue
  const clampedValue = !Array.isArray(value)
    ? value
    : value.map(v => {
        const upperLimit = typeof maxVisualValue === 'number' ? Math.min(max, maxVisualValue) : max
        return Math.max(min, Math.min(upperLimit, v))
      })

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={clampedValue}
      min={min}
      max={max}
      disabled={disabled}
      onValueChange={onValueChange}
      className={cn('group relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col', className)}
      ref={sliderRef}
      {...props}
    >
      <SliderPrimitive.Track data-slot="slider-track" className={cn('bg-muted relative grow overflow-hidden rounded-full cursor-pointer data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5')}>
        {/* Visual remaining bar */}
        {typeof maxVisualValue === 'number' && maxVisualValue > min && (
          <div
            className={cn('absolute left-0 top-0 h-full pointer-events-none bg-[size:8px_8px] bg-top-left', 'dark:text-white/5 dark:bg-white/3 text-black/10 bg-black/5', 'bg-[image:repeating-linear-gradient(315deg,currentColor_0,currentColor_1px,transparent_1px,transparent_50%)]')}
            style={{ width: `${visualPercent}%` }}
          />
        )}
        <SliderPrimitive.Range data-slot="slider-range" className={cn('bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full')} />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            'border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow,opacity] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
            thumbVisibleOnHover && 'opacity-0 group-hover:opacity-100 transition-opacity duration-200'
          )}
          tabIndex={0}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
