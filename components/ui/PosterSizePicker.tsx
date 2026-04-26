"use client";

import { type PosterSize } from "@/store/settings";
import { cn } from "@/lib/utils";

interface PosterSizePickerProps {
  value: PosterSize;
  onChange: (size: PosterSize) => void;
  accentColor?: string;
}

const sizes: { value: PosterSize; label: string; cols: number[] }[] = [
  { value: "xs", label: "XS", cols: [3, 3, 3] },
  { value: "sm", label: "S",  cols: [3, 2, 2] },
  { value: "md", label: "M",  cols: [2, 2, 2] },
  { value: "lg", label: "L",  cols: [2, 1, 1] },
  { value: "xl", label: "XL", cols: [1, 1, 1] },
];

/** Mini poster-grid icon representing the size option */
function GridIcon({ cols }: { cols: number[] }) {
  return (
    <div className="flex flex-col gap-[2px]">
      {cols.map((n, row) => (
        <div key={row} className="flex gap-[2px]">
          {Array.from({ length: n }).map((_, i) => (
            <div
              key={i}
              className="rounded-[1px] bg-current"
              style={{ width: n === 1 ? 10 : n === 2 ? 7 : 5, height: n === 1 ? 14 : n === 2 ? 10 : 7 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PosterSizePicker({ value, onChange, accentColor }: PosterSizePickerProps) {
  return (
    <div className="flex items-center gap-0.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-1">
      {sizes.map((size) => {
        const active = value === size.value;
        return (
          <button
            key={size.value}
            title={`Poster size: ${size.label}`}
            onClick={() => onChange(size.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-all",
              active
                ? "bg-[var(--color-border-bright)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
            style={active && accentColor ? { color: accentColor } : undefined}
          >
            <GridIcon cols={size.cols} />
            <span>{size.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Returns the Tailwind grid-cols class string for a given poster size.
 * These must be full static strings so Tailwind includes them.
 */
export function posterGridClass(size: PosterSize): string {
  const map: Record<PosterSize, string> = {
    xs: "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
    sm: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8",
    md: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
    lg: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    xl: "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };
  return map[size];
}
