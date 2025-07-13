import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbVisibleOnHover = true,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbVisibleOnHover?: boolean
}) {
  const sliderRef = React.useRef<HTMLDivElement>(null);
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  const handleWheel = React.useCallback(
    (e: WheelEvent) => {
      if (typeof value === "undefined" || !Array.isArray(value)) return;
      if (props.disabled) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * (e.shiftKey ? 10 : 1);
      const newValue = Math.max(min, Math.min(max, value[0] - delta));
      if (props.onValueChange) {
        props.onValueChange([newValue]);
      }
    },
    [value, min, max, props]
  );

  React.useEffect(() => {
    const sliderEl = sliderRef.current;
    if (!sliderEl) return;
    sliderEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      sliderEl.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "group relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      ref={sliderRef}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full cursor-pointer data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className={cn(
            "border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow,opacity] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
            thumbVisibleOnHover && "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          )}
          tabIndex={0}
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
