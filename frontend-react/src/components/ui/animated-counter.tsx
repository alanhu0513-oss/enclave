import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "motion/react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({ value, duration = 1.5, className, prefix, suffix }: AnimatedCounterProps) {
  const spring = useSpring(0, { duration: duration * 1000 });
  const display = useTransform(spring, (current) => Math.round(current));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    return display.on("change", (v) => setDisplayValue(v));
  }, [display]);

  return (
    <motion.span className={className}>
      {prefix}{displayValue}{suffix}
    </motion.span>
  );
}
