/**
 * Slider Component
 * 
 * Range slider for numeric inputs.
 * Uses native input[type=range] with custom styling.
 * 
 * @example
 * <Slider value={volume} onChange={setVolume} min={0} max={100} />
 * <Slider value={fontSize} onChange={setFontSize} min={10} max={24} step={1} showValue />
 */

import * as React from 'react';
import { cn } from '@/lib/cn';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
  className?: string;
  label?: string;
}

const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  showValue = false,
  valueFormatter = (v) => String(v),
  className,
  label,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const id = React.useId();

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {label && (
        <label htmlFor={id} className="text-sm text-subtext-1 min-w-[80px]">
          {label}
        </label>
      )}
      <div className="relative flex-1 flex items-center">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(
            'w-full h-1.5 appearance-none bg-surface-1 rounded-full cursor-pointer',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            // Track styling (filled portion)
            '[&::-webkit-slider-runnable-track]:h-1.5',
            '[&::-webkit-slider-runnable-track]:rounded-full',
            // Thumb styling
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-mauve',
            '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-crust',
            '[&::-webkit-slider-thumb]:shadow-md',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-fast',
            '[&::-webkit-slider-thumb]:hover:scale-110',
            '[&::-webkit-slider-thumb]:-mt-[5px]',
            // Firefox
            '[&::-moz-range-track]:h-1.5',
            '[&::-moz-range-track]:rounded-full',
            '[&::-moz-range-track]:bg-surface-1',
            '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4',
            '[&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-mauve',
            '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-crust',
            '[&::-moz-range-thumb]:cursor-pointer',
            // Focus
            'focus:outline-none',
            'focus-visible:ring-2 focus-visible:ring-mauve focus-visible:ring-offset-2 focus-visible:ring-offset-base'
          )}
          style={{
            background: `linear-gradient(to right, var(--mauve) 0%, var(--mauve) ${percentage}%, var(--surface1) ${percentage}%, var(--surface1) 100%)`,
          }}
        />
      </div>
      {showValue && (
        <span className="text-sm text-text font-mono min-w-[40px] text-right">
          {valueFormatter(value)}
        </span>
      )}
    </div>
  );
};

// Labeled slider with description
interface LabeledSliderProps extends SliderProps {
  description?: string;
}

const LabeledSlider: React.FC<LabeledSliderProps> = ({
  label,
  description,
  className,
  ...props
}) => (
  <div className={cn('space-y-2', className)}>
    <div className="flex items-center justify-between">
      {label && <span className="text-sm font-medium text-text">{label}</span>}
      {props.showValue && (
        <span className="text-sm text-subtext-1 font-mono">
          {props.valueFormatter?.(props.value) ?? props.value}
        </span>
      )}
    </div>
    <Slider {...props} showValue={false} />
    {description && (
      <p className="text-xs text-subtext-0">{description}</p>
    )}
  </div>
);

export { Slider, LabeledSlider };
