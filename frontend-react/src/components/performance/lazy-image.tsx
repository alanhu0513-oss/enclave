import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
}

export function LazyImage({ src, alt, className, placeholder }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      {placeholder && !loaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
      )}
      {inView && (
        <img
          src={src}
          alt={alt}
          className={cn("transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
