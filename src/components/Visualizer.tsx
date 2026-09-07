import { useEffect, useRef } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';
import type { VisualizerMode } from '../types';

interface Props {
  engine: AudioEngine;
  mode: VisualizerMode;
  active: boolean;
}

export function Visualizer({ engine, mode, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frequency = new Uint8Array(engine.frequencyBinCount);
    const time = new Uint8Array(engine.frequencyBinCount);
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return rect;
    };

    const render = () => {
      const rect = resize();
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);

      const wash = ctx.createLinearGradient(0, 0, width, height);
      wash.addColorStop(0, 'rgba(13, 18, 22, 0.98)');
      wash.addColorStop(0.5, 'rgba(8, 12, 16, 0.94)');
      wash.addColorStop(1, 'rgba(17, 10, 20, 0.98)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      engine.readFrequencyData(frequency);
      engine.readTimeData(time);

      if (mode === 'scope') drawScope(ctx, time, width, height, active);
      else if (mode === 'orbital') drawOrbital(ctx, frequency, width, height, active);
      else drawSpectrum(ctx, frequency, width, height, active);

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [engine, mode, active]);

  return <canvas className="visualizer-canvas" ref={canvasRef} aria-label={`${mode} audio visualizer`} />;
}

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
  active: boolean,
) {
  const bars = Math.min(96, Math.max(28, Math.floor(width / 9)));
  const gap = 2;
  const barWidth = Math.max(2, width / bars - gap);

  for (let i = 0; i < bars; i += 1) {
    const sourceIndex = Math.floor((i / bars) * data.length * 0.68);
    const value = active ? data[sourceIndex] / 255 : 0.035 + Math.sin(i * 0.55) * 0.015;
    const barHeight = Math.max(2, value * height * 0.82);
    const x = i * (barWidth + gap);
    const y = height - barHeight;
    const hue = 168 + (i / bars) * 118;
    ctx.fillStyle = `hsla(${hue}, 88%, 62%, ${0.45 + value * 0.5})`;
    ctx.fillRect(x, y, barWidth, barHeight);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(active ? 'LIVE FFT // 2048' : 'FFT STANDBY', 18, 24);
}

function drawScope(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
  active: boolean,
) {
  ctx.strokeStyle = 'rgba(111, 255, 213, 0.82)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const slice = width / Math.max(1, data.length - 1);
  data.forEach((value, index) => {
    const normalized = active ? value / 255 : 0.5 + Math.sin(index * 0.05) * 0.005;
    const x = index * slice;
    const y = normalized * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = 'rgba(111, 255, 213, 0.13)';
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function drawOrbital(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  width: number,
  height: number,
  active: boolean,
) {
  const cx = width / 2;
  const cy = height / 2;
  const baseRadius = Math.min(width, height) * 0.18;
  const points = 140;

  for (let i = 0; i < points; i += 1) {
    const sourceIndex = Math.floor((i / points) * data.length * 0.72);
    const energy = active ? data[sourceIndex] / 255 : 0.04;
    const angle = (i / points) * Math.PI * 2 - performance.now() * 0.00008;
    const radius = baseRadius + energy * Math.min(width, height) * 0.28;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    ctx.fillStyle = `hsla(${185 + (i / points) * 150}, 90%, 66%, ${0.2 + energy * 0.72})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + energy * 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.45);
  glow.addColorStop(0, 'rgba(101, 255, 211, 0.19)');
  glow.addColorStop(1, 'rgba(101, 255, 211, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius * 1.45, 0, Math.PI * 2);
  ctx.fill();
}
