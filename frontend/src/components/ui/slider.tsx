"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  value: number[]
  onValueChange: (value: number[]) => void
  max?: number
  min?: number
  step?: number
  className?: string
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value, onValueChange, max = 100, min = 0, step = 1, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange([parseFloat(e.target.value)])
    }

    const percentage = ((value[0] - min) / (max - min)) * 100

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center py-4",
          className
        )}
        {...props}
      >
        <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
          <div 
            className="absolute h-full bg-primary transition-all duration-200" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={handleChange}
          className="absolute w-full h-2 opacity-0 cursor-pointer z-10"
        />
        <div 
          className="absolute h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-all pointer-events-none"
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
