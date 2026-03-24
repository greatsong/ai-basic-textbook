import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Color constants (다크 테마) ───
const C = {
  bg: 'rgba(15,23,42,0.96)',
  card: 'rgba(30,41,59,0.7)',
  border: 'rgba(71,85,105,0.25)',
  borderLight: 'rgba(71,85,105,0.15)',
  text: '#e2e8f0',
  muted: '#94a3b8',
  dim: '#64748b',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#ef4444',
  orange: '#fdba74',
  pink: '#fca5a5',
  blue: '#3b82f6',
  cyan: '#06b6d4',
};

const mono = 'var(--sl-font-mono, monospace)';

// ─── Types ───
interface Props {
  mode?: 'initial' | 'strategic';
}

type SimStatus = 'idle' | 'running' | 'paused' | 'converged' | 'diverged' | 'local_minimum';

interface TrailPoint {
  x: number;
  z: number;
  y: number;
  loss: number;
}

interface BallState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  loss: number;
  step: number;
  status: SimStatus;
  trail: TrailPoint[];
  lossHistory: number[];
  gradX: number;
  gradZ: number;
}

// ─── 3-level Loss functions (adapted from source) ───

// Level 1: Simple parabola + small local minimum
function lossLevel1(x: number, z: number): number {
  const bowl = 0.15 * (x * x + z * z);
  // Small local minimum to trap the ball
  const localTrap = -0.6 * Math.exp(-((x + 3) * (x + 3) + (z + 3) * (z + 3)) / 1.5);
  return bowl + localTrap + 0.6;
}

function gradientLevel1(x: number, z: number): { gx: number; gz: number } {
  let gx = 0.3 * x;
  let gz = 0.3 * z;
  const expL = Math.exp(-((x + 3) * (x + 3) + (z + 3) * (z + 3)) / 1.5);
  gx += -0.6 * expL * (-2 * (x + 3) / 1.5);
  gz += -0.6 * expL * (-2 * (z + 3) / 1.5);
  return { gx, gz };
}

// Level 2: Two local minima + one global (classic trap terrain)
function lossLevel2(x: number, z: number): number {
  const bowl = 0.03 * (x * x + z * z);
  const globalMin = -2.5 * Math.exp(-(x * x + (z - 2) * (z - 2)) / 3);
  const localMin1 = -1.0 * Math.exp(-((x + 3) * (x + 3) + (z + 2) * (z + 2)) / 2);
  const localMin2 = -1.2 * Math.exp(-((x - 3) * (x - 3) + (z + 2) * (z + 2)) / 2);
  const noise = 0.2 * Math.sin(x) * Math.cos(z);
  return bowl + globalMin + localMin1 + localMin2 + noise + 3;
}

function gradientLevel2(x: number, z: number): { gx: number; gz: number } {
  let gx = 0.06 * x;
  let gz = 0.06 * z;
  const expGlobal = Math.exp(-(x * x + (z - 2) * (z - 2)) / 3);
  gx += -2.5 * expGlobal * (-2 * x / 3);
  gz += -2.5 * expGlobal * (-2 * (z - 2) / 3);
  const expL1 = Math.exp(-((x + 3) * (x + 3) + (z + 2) * (z + 2)) / 2);
  gx += -1.0 * expL1 * (-(x + 3));
  gz += -1.0 * expL1 * (-(z + 2));
  const expL2 = Math.exp(-((x - 3) * (x - 3) + (z + 2) * (z + 2)) / 2);
  gx += -1.2 * expL2 * (-(x - 3));
  gz += -1.2 * expL2 * (-(z + 2));
  gx += 0.2 * Math.cos(x) * Math.cos(z);
  gz += 0.2 * Math.sin(x) * (-Math.sin(z));
  return { gx, gz };
}

// Level 3: Saddle points + narrow valleys (advanced)
function lossLevel3(x: number, z: number): number {
  const r2 = x * x + z * z;
  const bowl = 0.02 * r2;
  const saddleExp = Math.exp(-r2 / 20);
  const saddle = 0.3 * (x * x - z * z) * saddleExp;
  const globalMin = -3.0 * Math.exp(-((x - 1) * (x - 1) + (z - 2) * (z - 2)) / 1.5);
  const local1 = -1.5 * Math.exp(-((x + 4) * (x + 4) + (z + 1) * (z + 1)) / 2);
  const local2 = -1.3 * Math.exp(-((x - 4) * (x - 4) + (z - 3) * (z - 3)) / 2);
  const local3 = -1.0 * Math.exp(-((x + 2) * (x + 2) + (z - 4) * (z - 4)) / 1.5);
  const local4 = -0.8 * Math.exp(-((x - 2) * (x - 2) + (z + 4) * (z + 4)) / 1.5);
  const noise = 0.3 * Math.sin(2 * x) * Math.cos(2 * z);
  return bowl + saddle + globalMin + local1 + local2 + local3 + local4 + noise + 4;
}

function gradientLevel3(x: number, z: number): { gx: number; gz: number } {
  const r2 = x * x + z * z;
  let gx = 0.04 * x;
  let gz = 0.04 * z;
  const saddleExp = Math.exp(-r2 / 20);
  const diff = x * x - z * z;
  gx += 0.3 * saddleExp * (2 * x - 0.1 * x * diff);
  gz += 0.3 * saddleExp * (-2 * z - 0.1 * z * diff);
  const expG = Math.exp(-((x - 1) * (x - 1) + (z - 2) * (z - 2)) / 1.5);
  gx += 4.0 * (x - 1) * expG;
  gz += 4.0 * (z - 2) * expG;
  const expL1 = Math.exp(-((x + 4) * (x + 4) + (z + 1) * (z + 1)) / 2);
  gx += 1.5 * (x + 4) * expL1;
  gz += 1.5 * (z + 1) * expL1;
  const expL2 = Math.exp(-((x - 4) * (x - 4) + (z - 3) * (z - 3)) / 2);
  gx += 1.3 * (x - 4) * expL2;
  gz += 1.3 * (z - 3) * expL2;
  const expL3 = Math.exp(-((x + 2) * (x + 2) + (z - 4) * (z - 4)) / 1.5);
  gx += (2 / 1.5) * (x + 2) * expL3;
  gz += (2 / 1.5) * (z - 4) * expL3;
  const expL4 = Math.exp(-((x - 2) * (x - 2) + (z + 4) * (z + 4)) / 1.5);
  gx += (2 * 0.8 / 1.5) * (x - 2) * expL4;
  gz += (2 * 0.8 / 1.5) * (z + 4) * expL4;
  gx += 0.6 * Math.cos(2 * x) * Math.cos(2 * z);
  gz += -0.6 * Math.sin(2 * x) * Math.sin(2 * z);
  return { gx, gz };
}

// Dispatchers
function lossByLevel(x: number, z: number, level: number): number {
  if (level === 1) return lossLevel1(x, z);
  if (level === 3) return lossLevel3(x, z);
  return lossLevel2(x, z);
}

function gradByLevel(x: number, z: number, level: number): { gx: number; gz: number } {
  if (level === 1) return gradientLevel1(x, z);
  if (level === 3) return gradientLevel3(x, z);
  return gradientLevel2(x, z);
}

// ─── Auto-find global minimum via grid search ───
function findGlobalMinimum(level: number, halfSize: number = 10, res: number = 200): { x: number; z: number; loss: number } {
  let bestX = 0, bestZ = 0, bestLoss = Infinity;
  for (let i = 0; i <= res; i++) {
    for (let j = 0; j <= res; j++) {
      const x = -halfSize + (i / res) * 2 * halfSize;
      const z = -halfSize + (j / res) * 2 * halfSize;
      const l = lossByLevel(x, z, level);
      if (l < bestLoss) {
        bestLoss = l;
        bestX = x;
        bestZ = z;
      }
    }
  }
  return { x: bestX, z: bestZ, loss: bestLoss };
}

// ─── Preset starting points per level ───
const PRESETS: Record<number, { label: string; x: number; z: number }[]> = {
  1: [
    { label: 'A', x: -6, z: 6 },
    { label: 'B', x: 5, z: -5 },
    { label: 'C', x: -4, z: -2 },
    { label: 'D', x: 7, z: 3 },
  ],
  2: [
    { label: 'A', x: -7, z: -6 },
    { label: 'B', x: 6, z: -5 },
    { label: 'C', x: -5, z: 5 },
    { label: 'D', x: 7, z: 7 },
  ],
  3: [
    { label: 'A', x: -7, z: -7 },
    { label: 'B', x: 6, z: -4 },
    { label: 'C', x: -3, z: 6 },
    { label: 'D', x: 8, z: 5 },
  ],
};

const LEVEL_META = [
  { level: 1, name: '완만한 언덕', emoji: '⛳', difficulty: '초급' },
  { level: 2, name: '함정 지형', emoji: '🏔️', difficulty: '중급' },
  { level: 3, name: '악마의 지형', emoji: '🌋', difficulty: '고급' },
];

const TERRAIN_HALF = 10;
const TERRAIN_SIZE = TERRAIN_HALF * 2;
const TERRAIN_SEGS = 100;

// ─── WebGL detection ───
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────
// 3D SUB-COMPONENTS
// ──────────────────────────────────────────

// Delta clamping for tab-switching stability
function DeltaClamp() {
  useFrame((state, delta) => {
    if (delta > 0.1) {
      state.clock.elapsedTime -= (delta - 0.016);
    }
  });
  return null;
}

// 3D Loss surface
function LossSurface({ level, onClickTerrain }: { level: number; onClickTerrain?: (x: number, z: number) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
    const positions = geo.attributes.position;
    const colorArray = new Float32Array(positions.count * 3);

    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const zPlane = positions.getY(i);
      const y = lossByLevel(x, -zPlane, level);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const zPlane = positions.getY(i);
      const y = lossByLevel(x, -zPlane, level);
      positions.setZ(i, y);

      const t = maxY > minY ? (y - minY) / (maxY - minY) : 0;
      const color = new THREE.Color();
      if (t < 0.3) {
        color.setHSL(0.6, 0.9, 0.3 + t * 0.5);
      } else if (t < 0.6) {
        color.setHSL(0.45 - (t - 0.3) * 1.0, 0.85, 0.5);
      } else {
        color.setHSL(0.08 - (t - 0.6) * 0.15, 0.9, 0.45 + (t - 0.6) * 0.3);
      }
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    geo.computeVertexNormals();
    return geo;
  }, [level]);

  const handleClick = useCallback((e: any) => {
    if (!onClickTerrain) return;
    e.stopPropagation();
    const point = e.point as THREE.Vector3;
    // The group is rotated -PI/2 around X, so we need to invert the transform
    // In the rotated group: world Y -> local Z, world Z -> -local Y
    // point is in world coords: (x, y, z) where y is up
    // terrain local x -> world x, terrain local -y -> world z
    // So: terrain x = point.x, terrain z = point.z (but due to rotation: terrain z = -zPlane = world z direction)
    onClickTerrain(point.x, point.z);
  }, [onClickTerrain]);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry} onClick={handleClick}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.6}
          metalness={0.2}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          wireframe
          color="#4a3a8a"
          transparent
          opacity={0.12}
        />
      </mesh>
    </group>
  );
}

// Goal marker at global minimum
function GoalMarker({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 1.5;
      meshRef.current.position.y = position[1] + 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={position}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={1.5}
          roughness={0.1}
          metalness={1}
        />
      </mesh>
      <mesh position={[position[0], position[1] - 0.1, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.6, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Racing ball with gradient + momentum arrows
function RacingBall({ ball, level }: { ball: BallState; level: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const targetPos = useMemo(() => {
    const y = lossByLevel(ball.x, ball.z, level);
    return new THREE.Vector3(ball.x, y + 0.2, ball.z);
  }, [ball.x, ball.z, level]);

  const isEscaped = ball.status === 'diverged';
  const isConverged = ball.status === 'converged';
  const isLocal = ball.status === 'local_minimum';

  const ballColor = isEscaped ? '#ff4444' : isConverged ? '#10b981' : isLocal ? '#f59e0b' : '#06b6d4';

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.position.lerp(targetPos, Math.min(delta * 8, 1));
    if (glowRef.current) {
      glowRef.current.position.copy(meshRef.current.position);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      glowRef.current.scale.setScalar(isEscaped ? pulse * 1.5 : pulse);
    }
  });

  // Gradient arrow (red = gradient direction, shows steepest ascent)
  const gradMag = Math.sqrt(ball.gradX * ball.gradX + ball.gradZ * ball.gradZ);
  const gradArrowLen = Math.min(gradMag * 3, 3);

  // Momentum arrow (green = velocity)
  const velMag = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  const velArrowLen = Math.min(velMag * 5, 4);

  return (
    <group>
      {/* Glow */}
      <mesh ref={glowRef} position={targetPos.toArray()}>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshBasicMaterial
          color={ballColor}
          transparent
          opacity={isEscaped ? 0.3 : 0.12}
          depthWrite={false}
        />
      </mesh>

      {/* Ball */}
      <mesh ref={meshRef} position={targetPos.toArray()}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial
          color={ballColor}
          emissive={ballColor}
          emissiveIntensity={isEscaped ? 2.0 : isConverged ? 0.3 : 0.8}
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>

      {/* Gradient direction arrow (red - shows negative gradient = descent direction) */}
      {gradMag > 0.01 && ball.status === 'running' && (
        <arrowHelper
          args={[
            new THREE.Vector3(-ball.gradX / gradMag, 0, -ball.gradZ / gradMag).normalize(),
            new THREE.Vector3(targetPos.x, targetPos.y + 0.3, targetPos.z),
            gradArrowLen,
            0xef4444,
            0.3,
            0.15,
          ]}
        />
      )}

      {/* Momentum/velocity arrow (green) */}
      {velMag > 0.01 && ball.status === 'running' && (
        <arrowHelper
          args={[
            new THREE.Vector3(-ball.vx / velMag, 0, -ball.vz / velMag).normalize(),
            new THREE.Vector3(targetPos.x, targetPos.y + 0.35, targetPos.z),
            velArrowLen,
            0x10b981,
            0.25,
            0.12,
          ]}
        />
      )}

      {/* Trail */}
      {ball.trail.length > 1 && <TrailLine trail={ball.trail} level={level} />}
    </group>
  );
}

// Trail line
function TrailLine({ trail, level }: { trail: TrailPoint[]; level: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const recent = trail.slice(-200);
    for (const p of recent) {
      positions.push(p.x, p.y + 0.08, p.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [trail, level]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#06b6d4" transparent opacity={0.5} linewidth={2} />
    </line>
  );
}

// Camera presets
function CameraController({ preset }: { preset: 'birdseye' | 'ride' }) {
  const { camera } = useThree();
  useEffect(() => {
    if (preset === 'birdseye') {
      camera.position.set(0, 22, 16);
    }
    // ride view is handled by orbit controls following ball
  }, [preset, camera]);
  return null;
}

// ──────────────────────────────────────────
// LOSS GRAPH (SVG)
// ──────────────────────────────────────────

function LossGraph({ history, maxSteps }: { history: number[]; maxSteps: number }) {
  if (history.length < 2) {
    return (
      <div style={{
        height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.dim, fontSize: 12, fontFamily: mono,
      }}>
        데이터 수집 중...
      </div>
    );
  }

  const W = 260;
  const H = 120;
  const padL = 40;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxLoss = Math.max(...history) * 1.1;
  const minLoss = Math.min(0, Math.min(...history));
  const lossRange = maxLoss - minLoss || 1;

  const xStep = plotW / Math.max(history.length - 1, 1);

  const pathD = history.map((loss, i) => {
    const px = padL + i * xStep;
    const py = padT + plotH - ((loss - minLoss) / lossRange) * plotH;
    return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(' ');

  // Y-axis ticks
  const yTicks = 4;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) =>
    minLoss + (lossRange * i) / yTicks
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Grid lines */}
      {yTickVals.map((val, i) => {
        const py = padT + plotH - ((val - minLoss) / lossRange) * plotH;
        return (
          <g key={i}>
            <line x1={padL} y1={py} x2={W - padR} y2={py}
              stroke="rgba(100,116,139,0.2)" strokeWidth={0.5} />
            <text x={padL - 4} y={py + 3} textAnchor="end"
              fill={C.dim} fontSize={8} fontFamily={mono}>
              {val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Loss curve */}
      <path d={pathD} fill="none" stroke={C.cyan} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* Current point */}
      {history.length > 0 && (() => {
        const lastIdx = history.length - 1;
        const px = padL + lastIdx * xStep;
        const py = padT + plotH - ((history[lastIdx] - minLoss) / lossRange) * plotH;
        return <circle cx={px} cy={py} r={3} fill={C.cyan} />;
      })()}

      {/* Axis labels */}
      <text x={W / 2} y={H - 2} textAnchor="middle" fill={C.dim} fontSize={9}>스텝</text>
      <text x={6} y={H / 2} textAnchor="middle" fill={C.dim} fontSize={9}
        transform={`rotate(-90, 6, ${H / 2})`}>손실</text>
    </svg>
  );
}

// ──────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────

export default function GradientDescentRacing({ mode = 'initial' }: Props) {
  // State
  const [level, setLevel] = useState(1);
  const [lr, setLr] = useState(0.1);
  const [momentum, setMomentum] = useState(0.0);
  const [speedMult, setSpeedMult] = useState(1);
  const [stepMode, setStepMode] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'birdseye' | 'ride'>('birdseye');
  const [clickToPlace, setClickToPlace] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [visible, setVisible] = useState(true);

  const animRef = useRef<number | null>(null);
  const ballRef = useRef<BallState>({
    x: -6, z: 6, vx: 0, vz: 0, loss: 0, step: 0,
    status: 'idle', trail: [], lossHistory: [], gradX: 0, gradZ: 0,
  });
  const [ball, setBall] = useState<BallState>({ ...ballRef.current });

  // Check WebGL
  useEffect(() => {
    setWebglOk(isWebGLAvailable());
  }, []);

  // Visibility detection
  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Compute global minimum for current level
  const globalMin = useMemo(() => findGlobalMinimum(level), [level]);

  // Goal position in 3D
  const goalPos: [number, number, number] = useMemo(() => {
    return [globalMin.x, globalMin.loss + 0.2, globalMin.z];
  }, [globalMin]);

  // Initialize ball position
  const initBall = useCallback((x: number, z: number) => {
    const loss = lossByLevel(x, z, level);
    const { gx, gz } = gradByLevel(x, z, level);
    ballRef.current = {
      x, z, vx: 0, vz: 0, loss, step: 0,
      status: 'idle', trail: [{ x, z, y: loss, loss }],
      lossHistory: [loss], gradX: gx, gradZ: gz,
    };
    setBall({ ...ballRef.current });
  }, [level]);

  // Reset when level changes
  useEffect(() => {
    stopSim();
    const preset = PRESETS[level][0];
    initBall(preset.x, preset.z);
  }, [level, initBall]);

  // Single gradient step
  const doStep = useCallback(() => {
    const b = ballRef.current;
    if (b.status === 'converged' || b.status === 'diverged') return;

    const { gx, gz } = gradByLevel(b.x, b.z, level);

    // GD with momentum: v = momentum * v - lr * grad; pos += v
    const newVx = momentum * b.vx - lr * gx;
    const newVz = momentum * b.vz - lr * gz;
    const newX = b.x + newVx;
    const newZ = b.z + newVz;

    // Divergence check
    if (Math.abs(newX) > TERRAIN_HALF + 2 || Math.abs(newZ) > TERRAIN_HALF + 2) {
      b.status = 'diverged';
      b.gradX = gx;
      b.gradZ = gz;
      setBall({ ...b });
      return;
    }

    const newLoss = lossByLevel(newX, newZ, level);

    if (newLoss > b.lossHistory[0] * 10 || !isFinite(newLoss)) {
      b.status = 'diverged';
      b.gradX = gx;
      b.gradZ = gz;
      setBall({ ...b });
      return;
    }

    b.x = newX;
    b.z = newZ;
    b.vx = newVx;
    b.vz = newVz;
    b.loss = newLoss;
    b.step += 1;
    b.gradX = gx;
    b.gradZ = gz;
    b.trail.push({ x: newX, z: newZ, y: newLoss, loss: newLoss });
    b.lossHistory.push(newLoss);
    if (b.trail.length > 500) b.trail = b.trail.slice(-500);

    // Convergence check
    const gradMag = Math.sqrt(gx * gx + gz * gz);
    const distToGlobal = Math.sqrt((newX - globalMin.x) ** 2 + (newZ - globalMin.z) ** 2);

    if (distToGlobal < 0.3 && gradMag < 0.05) {
      b.status = 'converged';
    } else if (gradMag < 0.01 && b.step > 20) {
      // Check if stuck in local minimum
      if (distToGlobal > 1.0) {
        b.status = 'local_minimum';
      } else {
        b.status = 'converged';
      }
    }

    setBall({ ...b });
  }, [level, lr, momentum, globalMin]);

  // Animation loop
  const runSim = useCallback(() => {
    if (stepMode) return;
    ballRef.current.status = 'running';
    setBall({ ...ballRef.current });

    let lastTime = performance.now();
    const BASE_INTERVAL = 50; // ms per step at 1x

    const loop = () => {
      const now = performance.now();
      const elapsed = now - lastTime;
      const interval = BASE_INTERVAL / speedMult;

      if (elapsed >= interval) {
        lastTime = now;
        const b = ballRef.current;
        if (b.status !== 'running') {
          animRef.current = null;
          return;
        }
        doStep();
      }

      if (ballRef.current.status === 'running') {
        animRef.current = requestAnimationFrame(loop);
      }
    };

    animRef.current = requestAnimationFrame(loop);
  }, [stepMode, speedMult, doStep]);

  const stopSim = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const handleStart = useCallback(() => {
    const b = ballRef.current;
    if (b.status === 'converged' || b.status === 'diverged' || b.status === 'local_minimum') {
      // Already finished — do nothing, user should reset
      return;
    }
    if (stepMode) {
      b.status = 'running';
      setBall({ ...b });
    } else {
      runSim();
    }
  }, [stepMode, runSim]);

  const handlePause = useCallback(() => {
    stopSim();
    if (ballRef.current.status === 'running') {
      ballRef.current.status = 'paused';
      setBall({ ...ballRef.current });
    }
  }, [stopSim]);

  const handleReset = useCallback(() => {
    stopSim();
    const b = ballRef.current;
    initBall(b.trail[0]?.x ?? PRESETS[level][0].x, b.trail[0]?.z ?? PRESETS[level][0].z);
  }, [stopSim, initBall, level]);

  const handleOneStep = useCallback(() => {
    if (ballRef.current.status === 'idle' || ballRef.current.status === 'paused') {
      ballRef.current.status = 'running';
    }
    doStep();
  }, [doStep]);

  // Terrain click handler
  const handleTerrainClick = useCallback((x: number, z: number) => {
    if (!clickToPlace) return;
    stopSim();
    initBall(x, z);
    setClickToPlace(false);
  }, [clickToPlace, stopSim, initBall]);

  // Random start
  const handleRandom = useCallback(() => {
    stopSim();
    const rx = (Math.random() - 0.5) * TERRAIN_SIZE * 0.8;
    const rz = (Math.random() - 0.5) * TERRAIN_SIZE * 0.8;
    initBall(rx, rz);
  }, [stopSim, initBall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopSim(); };
  }, [stopSim]);

  // Educational message
  const getMessage = (): { text: string; color: string } => {
    switch (ball.status) {
      case 'converged':
        return { text: '수렴! 최적점에 도달했습니다', color: C.emerald };
      case 'diverged':
        return { text: '발산! 학습률을 줄여보세요', color: C.rose };
      case 'local_minimum':
        return { text: '로컬 미니마에 빠졌습니다 — 모멘텀을 올려보세요', color: C.amber };
      case 'running':
        return { text: '경사를 따라 내려가는 중...', color: C.cyan };
      case 'paused':
        return { text: '일시정지됨', color: C.muted };
      default:
        if (mode === 'strategic') {
          return { text: '학습률과 모멘텀을 조절하고 출발을 눌러보세요', color: C.muted };
        }
        return { text: '학습률을 조절하고 출발을 눌러보세요', color: C.muted };
    }
  };

  const msg = getMessage();

  // WebGL fallback
  if (!webglOk) {
    return (
      <div style={{
        background: `linear-gradient(145deg, ${C.bg}, rgba(10,15,30,0.98))`,
        borderRadius: 20, padding: '40px 20px', border: `1px solid ${C.border}`,
        maxWidth: 700, margin: '2rem auto', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🖥️</div>
        <h3 style={{ color: C.text, fontSize: 18, marginBottom: 8 }}>
          WebGL을 지원하지 않는 브라우저입니다
        </h3>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>
          3D 시각화를 보려면 Chrome, Firefox, Safari 등 최신 브라우저를 사용해 주세요.
        </p>
        <svg viewBox="0 0 400 200" style={{ maxWidth: 400, width: '100%' }}>
          {/* Static parabola fallback */}
          <defs>
            <linearGradient id="fallback-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={C.blue} />
              <stop offset="100%" stopColor={C.rose} />
            </linearGradient>
          </defs>
          <path d="M 30 170 Q 200 10 370 170" fill="none" stroke="url(#fallback-grad)" strokeWidth={3} />
          <circle cx={200} cy={90} r={8} fill={C.emerald} />
          <circle cx={100} cy={135} r={6} fill={C.cyan} />
          <text x={200} y={185} textAnchor="middle" fill={C.muted} fontSize={12}>
            경사하강법: 공이 가장 낮은 곳으로 굴러갑니다
          </text>
        </svg>
      </div>
    );
  }

  const isFinished = ball.status === 'converged' || ball.status === 'diverged' || ball.status === 'local_minimum';
  const isRunning = ball.status === 'running';

  return (
    <div style={{
      background: `linear-gradient(145deg, ${C.bg}, rgba(10,15,30,0.98))`,
      borderRadius: 20,
      padding: '20px 16px 16px',
      border: `1px solid ${C.border}`,
      maxWidth: 1000,
      margin: '2rem auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {/* ─── Header ─── */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 6,
        }}>
          <span style={{ fontSize: 14 }}>🏔️</span>
          <span style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
            경사하강법 레이싱
          </span>
        </div>
        <h3 style={{ color: C.text, fontSize: 18, fontWeight: 700, margin: '4px 0 2px' }}>
          공을 굴려 손실 함수의 최저점을 찾아라!
        </h3>
        <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
          학습률과 모멘텀을 조절하여 공을 글로벌 미니멈(별 마커)까지 안내하세요
        </p>
      </div>

      {/* ─── Camera + Level selectors ─── */}
      <div style={{
        display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap',
      }}>
        {/* Camera presets */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['birdseye', 'ride'] as const).map((p) => (
            <button key={p} onClick={() => setCameraPreset(p)} style={{
              padding: '5px 12px', borderRadius: 8, border: `1px solid ${cameraPreset === p ? C.violet : C.borderLight}`,
              background: cameraPreset === p ? 'rgba(139,92,246,0.15)' : 'rgba(30,41,59,0.5)',
              color: cameraPreset === p ? C.violet : C.muted, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {p === 'birdseye' ? '📷 조감도' : '🎢 탑승 시점'}
            </button>
          ))}
        </div>

        {/* Level selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {LEVEL_META.map((m) => (
            <button key={m.level} onClick={() => setLevel(m.level)} style={{
              padding: '5px 12px', borderRadius: 8,
              border: `1px solid ${level === m.level ? C.amber : C.borderLight}`,
              background: level === m.level ? 'rgba(245,158,11,0.12)' : 'rgba(30,41,59,0.5)',
              color: level === m.level ? C.amber : C.muted, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {m.emoji} {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Main content: 3D + side panel ─── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* 3D Canvas */}
        <div style={{
          flex: '1 1 480px', minHeight: 380, borderRadius: 14,
          overflow: 'hidden', background: 'rgba(5,10,25,0.8)',
          border: `1px solid ${C.borderLight}`,
          cursor: clickToPlace ? 'crosshair' : 'grab',
          position: 'relative',
        }}>
          {clickToPlace && (
            <div style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              zIndex: 10, background: 'rgba(139,92,246,0.9)', color: '#fff',
              padding: '6px 16px', borderRadius: 99, fontSize: 12, fontWeight: 600,
              pointerEvents: 'none',
            }}>
              지형을 클릭하여 출발점을 지정하세요
            </div>
          )}
          <Canvas
            camera={{ position: [0, 22, 16], fov: 55 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            dpr={[1, 2]}
            frameloop={visible ? 'always' : 'never'}
            style={{ width: '100%', height: '100%', minHeight: 380 }}
          >
            <DeltaClamp />
            <CameraController preset={cameraPreset} />

            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 20, 10]} intensity={0.8} color="#ffffff" />
            <pointLight position={[-5, 10, -5]} intensity={0.5} color="#7c5cfc" />
            <pointLight position={[5, 5, 5]} intensity={0.3} color="#22d3ee" />

            <LossSurface level={level} onClickTerrain={handleTerrainClick} />
            <GoalMarker position={goalPos} />
            <RacingBall ball={ball} level={level} />

            <OrbitControls
              enablePan
              enableZoom
              enableRotate
              maxDistance={40}
              minDistance={5}
              maxPolarAngle={Math.PI / 2.2}
              target={[0, 1, 0]}
            />
          </Canvas>
        </div>

        {/* Side panel */}
        <div style={{ flex: '0 0 270px', minWidth: 240 }}>
          {/* Stats */}
          <div style={{
            padding: '14px', borderRadius: 14,
            background: C.card, border: `1px solid ${C.borderLight}`,
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div>
                <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>손실값</div>
                <div style={{
                  fontFamily: mono, fontSize: 22, fontWeight: 700,
                  color: ball.loss < globalMin.loss + 0.5 ? C.emerald : ball.loss < globalMin.loss + 3 ? C.cyan : C.amber,
                }}>
                  {ball.loss.toFixed(3)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>스텝</div>
                <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: C.text }}>
                  {ball.step}
                </div>
              </div>
            </div>
            <div style={{ color: C.dim, fontSize: 10, marginTop: 4 }}>
              목표 손실: <span style={{ color: C.emerald, fontFamily: mono }}>{globalMin.loss.toFixed(3)}</span>
              {' '}| 위치: ({globalMin.x.toFixed(1)}, {globalMin.z.toFixed(1)})
            </div>
          </div>

          {/* Loss graph */}
          <div style={{
            padding: '10px 8px 6px', borderRadius: 14,
            background: C.card, border: `1px solid ${C.borderLight}`,
            marginBottom: 10,
          }}>
            <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 4, paddingLeft: 4 }}>
              손실 그래프
            </div>
            <LossGraph history={ball.lossHistory} maxSteps={ball.step} />
          </div>

          {/* Gradient info */}
          <div style={{
            padding: '10px 12px', borderRadius: 14,
            background: C.card, border: `1px solid ${C.borderLight}`,
          }}>
            <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>
              벡터 정보
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div style={{
                padding: '6px 8px', borderRadius: 8, background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}>
                <div style={{ color: C.rose, fontSize: 9, fontWeight: 600 }}>기울기(Gradient)</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.text, marginTop: 2 }}>
                  ({ball.gradX.toFixed(2)}, {ball.gradZ.toFixed(2)})
                </div>
              </div>
              <div style={{
                padding: '6px 8px', borderRadius: 8, background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.15)',
              }}>
                <div style={{ color: C.emerald, fontSize: 9, fontWeight: 600 }}>속도(Velocity)</div>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.text, marginTop: 2 }}>
                  ({ball.vx.toFixed(2)}, {ball.vz.toFixed(2)})
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Controls ─── */}
      <div style={{
        marginTop: 14, padding: '16px', borderRadius: 14,
        background: C.card, border: `1px solid ${C.borderLight}`,
      }}>
        {/* Sliders row */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
          {/* Learning rate slider */}
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>학습률 (Learning Rate)</span>
              <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.orange }}>
                {lr.toFixed(3)}
              </span>
            </div>
            <input
              type="range" min={0.001} max={1.0} step={0.001}
              value={lr}
              onChange={e => setLr(Number(e.target.value))}
              style={{ width: '100%', accentColor: C.orange }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.dim, fontSize: 9 }}>0.001</span>
              <span style={{ color: C.dim, fontSize: 9 }}>1.0</span>
            </div>
          </div>

          {/* Momentum slider */}
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>모멘텀 (Momentum)</span>
              <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.emerald }}>
                {momentum.toFixed(2)}
              </span>
            </div>
            <input
              type="range" min={0} max={0.99} step={0.01}
              value={momentum}
              onChange={e => setMomentum(Number(e.target.value))}
              style={{ width: '100%', accentColor: C.emerald }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.dim, fontSize: 9 }}>0.0</span>
              <span style={{ color: C.dim, fontSize: 9 }}>0.99</span>
            </div>
          </div>
        </div>

        {/* Speed buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ color: C.muted, fontSize: 12, fontWeight: 600, lineHeight: '30px', marginRight: 4 }}>속도:</span>
          {[0.25, 0.5, 1, 2].map((s) => (
            <button key={s} onClick={() => { setSpeedMult(s); setStepMode(false); }} style={{
              padding: '4px 12px', borderRadius: 8,
              border: `1px solid ${!stepMode && speedMult === s ? C.cyan : C.borderLight}`,
              background: !stepMode && speedMult === s ? 'rgba(6,182,212,0.12)' : 'rgba(30,41,59,0.5)',
              color: !stepMode && speedMult === s ? C.cyan : C.muted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {s}x
            </button>
          ))}
          <button onClick={() => setStepMode(true)} style={{
            padding: '4px 12px', borderRadius: 8,
            border: `1px solid ${stepMode ? C.violet : C.borderLight}`,
            background: stepMode ? 'rgba(139,92,246,0.12)' : 'rgba(30,41,59,0.5)',
            color: stepMode ? C.violet : C.muted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            스텝 모드
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={handleStart} disabled={isFinished || isRunning} style={{
            padding: '8px 20px', borderRadius: 10,
            background: isFinished || isRunning ? 'rgba(30,41,59,0.4)' : 'rgba(6,182,212,0.15)',
            border: `1px solid ${isFinished || isRunning ? C.borderLight : C.cyan}`,
            color: isFinished || isRunning ? C.dim : C.cyan,
            fontSize: 13, fontWeight: 700, cursor: isFinished || isRunning ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}>
            ▶ 출발!
          </button>
          <button onClick={handlePause} disabled={!isRunning} style={{
            padding: '8px 16px', borderRadius: 10,
            background: 'rgba(30,41,59,0.5)', border: `1px solid ${C.borderLight}`,
            color: isRunning ? C.amber : C.dim,
            fontSize: 13, fontWeight: 700, cursor: isRunning ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}>
            ⏸ 일시정지
          </button>
          <button onClick={handleReset} style={{
            padding: '8px 16px', borderRadius: 10,
            background: 'rgba(30,41,59,0.5)', border: `1px solid ${C.borderLight}`,
            color: C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            ↺ 리셋
          </button>
          {stepMode && (
            <button onClick={handleOneStep} disabled={isFinished} style={{
              padding: '8px 16px', borderRadius: 10,
              background: isFinished ? 'rgba(30,41,59,0.4)' : 'rgba(139,92,246,0.12)',
              border: `1px solid ${isFinished ? C.borderLight : C.violet}`,
              color: isFinished ? C.dim : C.violet,
              fontSize: 13, fontWeight: 700, cursor: isFinished ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}>
              → 한 스텝
            </button>
          )}
        </div>

        {/* Start position presets */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: C.muted, fontSize: 12, fontWeight: 600, marginRight: 4 }}>📍 출발점:</span>
          {PRESETS[level].map((p) => (
            <button key={p.label} onClick={() => { stopSim(); initBall(p.x, p.z); }} style={{
              padding: '4px 10px', borderRadius: 8,
              background: 'rgba(30,41,59,0.5)', border: `1px solid ${C.borderLight}`,
              color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {p.label}
            </button>
          ))}
          <button onClick={handleRandom} style={{
            padding: '4px 10px', borderRadius: 8,
            background: 'rgba(30,41,59,0.5)', border: `1px solid ${C.borderLight}`,
            color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            🎲 랜덤
          </button>
          <button onClick={() => { stopSim(); setClickToPlace(!clickToPlace); }} style={{
            padding: '4px 10px', borderRadius: 8,
            border: `1px solid ${clickToPlace ? C.violet : C.borderLight}`,
            background: clickToPlace ? 'rgba(139,92,246,0.12)' : 'rgba(30,41,59,0.5)',
            color: clickToPlace ? C.violet : C.muted,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            🖱️ 클릭 지정
          </button>
        </div>
      </div>

      {/* ─── Educational message ─── */}
      <div style={{
        marginTop: 10, padding: '10px 16px', borderRadius: 12,
        background: ball.status === 'converged' ? 'rgba(16,185,129,0.08)' :
                    ball.status === 'diverged' ? 'rgba(239,68,68,0.08)' :
                    ball.status === 'local_minimum' ? 'rgba(245,158,11,0.08)' :
                    'rgba(30,41,59,0.4)',
        border: `1px solid ${ball.status === 'converged' ? 'rgba(16,185,129,0.2)' :
                              ball.status === 'diverged' ? 'rgba(239,68,68,0.2)' :
                              ball.status === 'local_minimum' ? 'rgba(245,158,11,0.2)' :
                              C.borderLight}`,
        textAlign: 'center',
      }}>
        <span style={{ color: msg.color, fontSize: 14, fontWeight: 600 }}>
          💡 {msg.text}
        </span>
      </div>
    </div>
  );
}
