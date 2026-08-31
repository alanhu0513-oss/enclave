export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const scaleOnHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.2 },
};

export const glowPulse = {
  animate: {
    boxShadow: [
      "0 0 20px -4px rgba(0, 212, 255, 0.1)",
      "0 0 30px -4px rgba(0, 212, 255, 0.2)",
      "0 0 20px -4px rgba(0, 212, 255, 0.1)",
    ],
    transition: { duration: 2, repeat: Infinity },
  },
};

export const greenGlow = {
  animate: {
    boxShadow: [
      "0 0 20px -4px rgba(34, 197, 94, 0.1)",
      "0 0 30px -4px rgba(34, 197, 94, 0.25)",
      "0 0 20px -4px rgba(34, 197, 94, 0.1)",
    ],
    transition: { duration: 2, repeat: Infinity },
  },
};

export const redGlow = {
  animate: {
    boxShadow: [
      "0 0 20px -4px rgba(239, 68, 68, 0.15)",
      "0 0 35px -4px rgba(239, 68, 68, 0.3)",
      "0 0 20px -4px rgba(239, 68, 68, 0.15)",
    ],
    transition: { duration: 1.5, repeat: Infinity },
  },
};

export const buttonPulse = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(0, 191, 255, 0.4)",
      "0 0 0 8px rgba(0, 191, 255, 0)",
    ],
    transition: { duration: 1.5, repeat: Infinity },
  },
};

export const slideInFromRight = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

export const flipCard = {
  initial: { rotateY: -90, opacity: 0 },
  animate: { rotateY: 0, opacity: 1 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
};
