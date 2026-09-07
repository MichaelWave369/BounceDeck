import { useEffect, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/AudioEngine';

interface Props {
  engine: AudioEngine;
  active: boolean;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_low;
uniform float u_mid;
uniform float u_high;
uniform float u_rms;

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);

  float bassWarp = sin(angle * (3.0 + u_low * 5.0) + u_time * (0.18 + u_low * 0.42));
  float midWarp = sin((uv.x + uv.y) * (4.0 + u_mid * 9.0) - u_time * (0.32 + u_mid));
  float rings = 0.5 + 0.5 * sin(
    radius * (11.0 + u_high * 14.0)
    - u_time * (0.8 + u_mid * 1.8)
    + bassWarp * (1.2 + u_low * 2.0)
    + midWarp * 0.7
  );

  float spokes = 0.5 + 0.5 * sin(angle * (6.0 + floor(u_mid * 6.0)) + radius * 7.0 - u_time * 0.35);
  float core = exp(-radius * (2.4 - min(u_rms, 0.8)));
  float halo = 1.0 - smoothstep(0.15 + u_low * 0.12, 1.55, radius);
  float shimmer = 0.5 + 0.5 * sin((uv.x - uv.y) * 13.0 + u_time * (0.6 + u_high * 2.0));

  vec3 mint = vec3(0.18, 1.0, 0.73);
  vec3 violet = vec3(0.58, 0.18, 1.0);
  vec3 ember = vec3(1.0, 0.28, 0.14);
  vec3 midnight = vec3(0.015, 0.025, 0.045);

  vec3 color = mix(midnight, violet, rings * (0.34 + u_mid * 0.55));
  color = mix(color, mint, spokes * (0.18 + u_low * 0.65));
  color += ember * shimmer * u_high * 0.38;
  color += mint * core * (0.08 + u_rms * 0.72);
  color *= 0.22 + halo * (0.82 + u_rms * 0.95);

  float vignette = 1.0 - smoothstep(0.85, 1.8, radius);
  color *= 0.35 + 0.65 * vignette;
  color = pow(max(color, 0.0), vec3(0.88));

  gl_FragColor = vec4(color, 1.0);
}
`;

export function ShaderVisualizer({ engine, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) {
      setUnavailable(true);
      return;
    }

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) {
      setUnavailable(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('BounceDeck shader link failed:', gl.getProgramInfoLog(program));
      setUnavailable(true);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const position = gl.getAttribLocation(program, 'a_position');
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const time = gl.getUniformLocation(program, 'u_time');
    const low = gl.getUniformLocation(program, 'u_low');
    const mid = gl.getUniformLocation(program, 'u_mid');
    const high = gl.getUniformLocation(program, 'u_high');
    const rms = gl.getUniformLocation(program, 'u_rms');
    let raf = 0;

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const snapshot = active
        ? engine.snapshot()
        : { low: 0.035, mid: 0.025, high: 0.02, rms: 0.018 };

      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.enableVertexAttribArray(position);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolution, width, height);
      gl.uniform1f(time, performance.now() / 1000);
      gl.uniform1f(low, snapshot.low);
      gl.uniform1f(mid, snapshot.mid);
      gl.uniform1f(high, snapshot.high);
      gl.uniform1f(rms, snapshot.rms);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(raf);
      if (buffer) gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [active, engine]);

  return (
    <div className="shader-visualizer">
      <canvas className="visualizer-canvas" ref={canvasRef} aria-label="plasma audio reactive shader visualizer" />
      {unavailable && <div className="shader-fallback">WEBGL UNAVAILABLE // SWITCH VISUALIZER MODE</div>}
    </div>
  );
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('BounceDeck shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
