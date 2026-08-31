export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
};

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
};

export const slideInLeft = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export const scaleOnHover = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.99 },
  transition: { duration: 0.15 },
};

// Subtle breathing — not neon pulse
export const glowPulse = {
  animate: {
    opacity: [0.6, 1, 0.6],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
  },
};

export const greenGlow = {
  animate: {
    opacity: [0.6, 1, 0.6],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
  },
};

export const redGlow = {
  animate: {
    opacity: [0.7, 1, 0.7],
    transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const },
  },
};

export const buttonPulse = {
  animate: {
    scale: [1, 1.02, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
  },
};

export const slideInFromRight = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
};

export const flipCard = {
  initial: { rotateY: -90, opacity: 0 },
  animate: { rotateY: 0, opacity: 1 },
  transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
};
