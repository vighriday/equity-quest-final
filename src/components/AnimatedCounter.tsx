import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

function formatNumber(num: number, decimals: number): string {
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [direction, setDirection] = useState<"up" | "down" | "none">("none");
  const previousValueRef = useRef(value);
  const animationFrameRef = useRef<number | null>(null);

  const animate = useCallback(
    (from: number, to: number, startTime: number) => {
      const duration = 500;

      const step = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + (to - from) * eased;

        setDisplayValue(current);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
        }
      };

      animationFrameRef.current = requestAnimationFrame(step);
    },
    []
  );

  useEffect(() => {
    const prevValue = previousValueRef.current;

    if (prevValue !== value) {
      // Determine direction
      if (value > prevValue) {
        setDirection("up");
      } else if (value < prevValue) {
        setDirection("down");
      }

      // Cancel any ongoing animation
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Start new animation
      const startTime = performance.now();
      animate(prevValue, value, startTime);

      previousValueRef.current = value;

      // Reset direction highlight after animation
      const timer = setTimeout(() => setDirection("none"), 600);
      return () => {
        clearTimeout(timer);
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [value, animate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <span
      className={cn(
        "tabular-nums transition-colors duration-300",
        direction === "up" && "text-[hsl(var(--profit))]",
        direction === "down" && "text-[hsl(var(--loss))]",
        className
      )}
    >
      {prefix}
      {formatNumber(displayValue, decimals)}
      {suffix}
    </span>
  );
}

export default AnimatedCounter;
