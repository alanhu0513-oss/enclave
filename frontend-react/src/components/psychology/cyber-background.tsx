import { useEffect, useRef } from "react";

const KATAKANA =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>{}[]|/\\";

export function CyberBackground({ hidden = false, className = "" }: { hidden?: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || hidden) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W: number, H: number;
    let raf = 0;
    let frame = 0;

    // Matrix rain
    const fontSize = 14;
    let columns = 0;
    let drops: number[] = [];
    let dropSpeeds: number[] = [];
    let dropColors: string[] = [];

    // Circuit nodes
    let nodes: { x: number; y: number; vx: number; vy: number; r: number; pulse: number }[] = [];
    let nodeCount = 12;

    // HUD rings
    let hudRings: { x: number; y: number; r: number; angle: number; speed: number; color: string }[] = [];

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
      columns = Math.ceil(W / fontSize);
      drops = [];
      dropSpeeds = [];
      dropColors = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -100;
        dropSpeeds[i] = 0.3 + Math.random() * 0.7;
        dropColors[i] =
          Math.random() > 0.7 ? "#00FF88" : Math.random() > 0.5 ? "#00BFFF" : "#FF3366";
      }
      nodes = [];
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: 2 + Math.random() * 2,
          pulse: Math.random() * Math.PI * 2,
        });
      }
      hudRings = [
        { x: W * 0.15, y: H * 0.3, r: 60, angle: 0, speed: 0.003, color: "#00FF88" },
        { x: W * 0.85, y: H * 0.6, r: 45, angle: 0, speed: -0.005, color: "#00BFFF" },
        { x: W * 0.5, y: H * 0.15, r: 35, angle: 0, speed: 0.004, color: "#FF3366" },
      ];
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      ctx!.clearRect(0, 0, W, H);
      frame++;

      /* Matrix rain */
      ctx!.font = fontSize + "px monospace";
      for (let i = 0; i < columns; i++) {
        const ch = KATAKANA[Math.floor(Math.random() * KATAKANA.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        if (y > 0 && y < H) {
          ctx!.globalAlpha = 0.12 + Math.random() * 0.08;
          ctx!.fillStyle = dropColors[i];
          ctx!.fillText(ch, x, y);
        }
        if (y > H && Math.random() > 0.98) {
          drops[i] = 0;
          dropColors[i] =
            Math.random() > 0.7 ? "#00FF88" : Math.random() > 0.5 ? "#00BFFF" : "#FF3366";
        }
        drops[i] += dropSpeeds[i];
      }

      /* Circuit grid lines */
      ctx!.globalAlpha = 0.04;
      ctx!.strokeStyle = "#00FF88";
      ctx!.lineWidth = 0.5;
      const gridSize = 80;
      const offsetX = (frame * 0.2) % gridSize;
      for (let gx = -gridSize + offsetX; gx < W + gridSize; gx += gridSize) {
        ctx!.beginPath();
        ctx!.moveTo(gx, 0);
        ctx!.lineTo(gx, H);
        ctx!.stroke();
      }
      const offsetY = (frame * 0.15) % gridSize;
      for (let gy = -gridSize + offsetY; gy < H + gridSize; gy += gridSize) {
        ctx!.beginPath();
        ctx!.moveTo(0, gy);
        ctx!.lineTo(W, gy);
        ctx!.stroke();
      }

      /* Circuit nodes + connections */
      ctx!.globalAlpha = 1;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.02;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        const glow = 0.3 + 0.3 * Math.sin(n.pulse);
        ctx!.globalAlpha = glow;
        ctx!.fillStyle = "#00FF88";
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            ctx!.globalAlpha = (1 - dist / 200) * 0.15;
            ctx!.strokeStyle = "#00FF88";
            ctx!.lineWidth = 0.5;
            ctx!.beginPath();
            ctx!.moveTo(n.x, n.y);
            ctx!.lineTo(m.x, m.y);
            ctx!.stroke();
          }
        }
      }

      /* HUD rings */
      for (let r = 0; r < hudRings.length; r++) {
        const ring = hudRings[r];
        ring.angle += ring.speed;
        ctx!.globalAlpha = 0.12;
        ctx!.strokeStyle = ring.color;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.globalAlpha = 0.25;
        ctx!.beginPath();
        ctx!.arc(ring.x, ring.y, ring.r, ring.angle, ring.angle + Math.PI * 0.6);
        ctx!.stroke();
        ctx!.globalAlpha = 0.4;
        ctx!.fillStyle = ring.color;
        ctx!.beginPath();
        ctx!.arc(ring.x, ring.y, 2, 0, Math.PI * 2);
        ctx!.fill();
      }

      /* Horizontal scan line */
      ctx!.globalAlpha = 0.06;
      ctx!.fillStyle = "#00FF88";
      const scanY = (frame * 1.5) % H;
      ctx!.fillRect(0, scanY, W, 2);

      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [hidden]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 h-full w-full ${className}`}
      style={{ opacity: 0.6, width: "100%", height: "100%" }}
    />
  );
}
