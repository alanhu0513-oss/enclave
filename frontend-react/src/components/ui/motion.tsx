import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface AnimatedProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: number;
  y?: number;
}

export function FadeIn({
  children,
  className,
  delay = 0,
  y = 12,
  ...props
}: AnimatedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: y }}
      transition={{
        duration: 0.3,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(className)}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({
  children,
  className,
  stagger = 0.06,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { stagger?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
      className={cn(className)}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      className={cn(className)}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}
