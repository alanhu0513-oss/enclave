import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export { motion };

/* ── Shared easing tokens ─────────────────────────────── */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const SPRING = { type: "spring" as const, stiffness: 400, damping: 28 };

/* ── Kinetic hover: elevates and glows any surface ────── */
export function Kinetic({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  hidden?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      transition={SPRING}
      className={cn(className)}
      {...(props as any)}
    >
      {children}
    </motion.div>
  );
}

/* ── Expandable: smooth height/opacity toggle ─────────── */
export function Expandable({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={false}
      animate={{
        height: open ? "auto" : 0,
        opacity: open ? 1 : 0,
      }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      className={cn("overflow-hidden", className)}
    >
      {children}
    </motion.div>
  );
}

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
