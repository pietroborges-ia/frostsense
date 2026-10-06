import React, { useEffect, useRef } from 'react';

interface SnowParticlesProps {
  temperature: number;
}

interface Flake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  type: 'dot' | 'crystal' | 'flake';
}

export const SnowParticles: React.FC<SnowParticlesProps> = ({ temperature }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Number of flakes depends slightly on temperature (more flakes when colder)
    const flakeCount = temperature < 1 ? 65 : temperature <= 5 ? 45 : 20;

    const flakes: Flake[] = [];
    for (let i = 0; i < flakeCount; i++) {
      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.5 + 1,
        speedY: Math.random() * 0.6 + 0.25 + (temperature < 1 ? 0.35 : 0),
        speedX: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.5 + 0.2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        type: i % 4 === 0 ? 'crystal' : i % 3 === 0 ? 'flake' : 'dot',
      });
    }

    const drawCrystal = (x: number, y: number, size: number, rot: number, opacity: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.strokeStyle = `rgba(186, 230, 253, ${opacity})`;
      ctx.lineWidth = 1;

      // 6-arm snowflake crystal
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.stroke();

        // Branching spurs
        ctx.beginPath();
        ctx.moveTo(-size * 0.6, -size * 0.3);
        ctx.lineTo(-size * 0.4, 0);
        ctx.lineTo(-size * 0.6, size * 0.3);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size * 0.6, -size * 0.3);
        ctx.lineTo(size * 0.4, 0);
        ctx.lineTo(size * 0.6, size * 0.3);
        ctx.stroke();

        ctx.rotate(Math.PI / 3);
      }
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Flake color adjustments with crisp ice-white and frosty tones
      let baseR = 240;
      let baseG = 248;
      let baseB = 255;

      if (temperature > 5) {
        // warmer tone fading
        baseR = 254;
        baseG = 225;
        baseB = 195;
      } else if (temperature < 1) {
        // icy crystalline violet-white
        baseR = 224;
        baseG = 231;
        baseB = 255;
      }

      for (const flake of flakes) {
        flake.y += flake.speedY;
        flake.x += flake.speedX + Math.sin(flake.y * 0.005) * 0.3;
        flake.rotation += flake.rotationSpeed;

        if (flake.y > height + 10) {
          flake.y = -10;
          flake.x = Math.random() * width;
        }
        if (flake.x > width + 10) flake.x = -10;
        if (flake.x < -10) flake.x = width + 10;

        if (flake.type === 'crystal' && flake.radius > 2) {
          drawCrystal(flake.x, flake.y, flake.radius * 2.2, flake.rotation, flake.opacity);
        } else if (flake.type === 'flake') {
          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${baseR}, ${baseG}, ${baseB}, ${flake.opacity * 0.8})`;
          ctx.shadowBlur = 6;
          ctx.shadowColor = `rgba(${baseR}, ${baseG}, ${baseB}, 0.5)`;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity * 0.5})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [temperature]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      aria-hidden="true"
    />
  );
};
