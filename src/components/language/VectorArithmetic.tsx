import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Color constants (dark theme) ───
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
  cyan: '#22d3ee',
};

const mono = 'var(--sl-font-mono, monospace)';

// ─── Analogy data ───
interface Analogy {
  id: string;
  label: string;
  a: { word: string; vec: [number, number, number] };
  b: { word: string; vec: [number, number, number] };
  c: { word: string; vec: [number, number, number] };
  result: { word: string; vec: [number, number, number] };
  explanation: string;
}

const ANALOGIES: Analogy[] = [
  {
    id: 'royalty',
    label: '왕 - 남자 + 여자',
    a: { word: '왕', vec: [0.9, 0.9, 0.2] },
    b: { word: '남자', vec: [0.2, 0.9, 0.1] },
    c: { word: '여자', vec: [0.2, 0.2, 0.1] },
    result: { word: '여왕', vec: [0.9, 0.2, 0.2] },
    explanation: '왕에서 남자를 빼면 "왕족"이라는 의미만 남고, 여자를 더하면 여왕이 됩니다.',
  },
  {
    id: 'capital',
    label: '파리 - 프랑스 + 일본',
    a: { word: '파리', vec: [0.9, 0.8, 0.3] },
    b: { word: '프랑스', vec: [0.2, 0.8, 0.3] },
    c: { word: '일본', vec: [0.2, 0.2, 0.3] },
    result: { word: '도쿄', vec: [0.9, 0.2, 0.3] },
    explanation: '파리에서 프랑스를 빼면 "수도"라는 관계만 남고, 일본을 더하면 도쿄가 됩니다.',
  },
  {
    id: 'tense',
    label: '걷다 - 걸었다 + 수영했다',
    a: { word: '걷다', vec: [0.3, 0.8, 0.5] },
    b: { word: '걸었다', vec: [0.3, 0.2, 0.5] },
    c: { word: '수영했다', vec: [0.8, 0.2, 0.5] },
    result: { word: '수영하다', vec: [0.8, 0.8, 0.5] },
    explanation: '걷다에서 걸었다를 빼면 "현재형" 변환이 남고, 수영했다에 더하면 수영하다가 됩니다.',
  },
];

// ─── Vector math helpers ───
function vecSub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [+(a[0] - b[0]).toFixed(1), +(a[1] - b[1]).toFixed(1), +(a[2] - b[2]).toFixed(1)];
}
function vecAdd(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [+(a[0] + b[0]).toFixed(1), +(a[1] + b[1]).toFixed(1), +(a[2] + b[2]).toFixed(1)];
}
function fmtVec(v: [number, number, number]): string {
  return `[${v.map(n => n.toFixed(1)).join(', ')}]`;
}

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

// ─── Steps ───
const STEP_LABELS = ['A 벡터', 'A - B', '중간 결과', '+ C', '최종 결과'];

// ──────────────────────────────────────
// 3D Sub-components
// ──────────────────────────────────────

/** Frame delta clamping: prevents huge delta after tab switch */
function DeltaClamp() {
  useFrame((state, delta) => {
    if (delta > 0.1) {
      state.clock.elapsedTime -= (delta - 0.016);
    }
  });
  return null;
}

// ─── 3D Arrow (cylinder shaft + cone head) ───
const SHAFT_RADIUS = 0.015;
const HEAD_LENGTH = 0.06;
const HEAD_RADIUS = 0.03;
const SHAFT_SEGMENTS = 8;

interface Arrow3DProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  dashed?: boolean;
  opacity?: number;
}

function Arrow3D({ from, to, color, dashed, opacity = 1 }: Arrow3DProps) {
  const dir = new THREE.Vector3(
    to[0] - from[0], to[1] - from[1], to[2] - from[2],
  );
  const length = dir.length();
  if (length < 0.01) return null;

  const shaftLen = Math.max(length - HEAD_LENGTH, 0);
  const midPoint = new THREE.Vector3(from[0], from[1], from[2]).add(
    dir.clone().normalize().multiplyScalar(shaftLen / 2),
  );
  const headCenter = new THREE.Vector3(from[0], from[1], from[2]).add(
    dir.clone().normalize().multiplyScalar(shaftLen + HEAD_LENGTH / 2),
  );

  // Quaternion to orient along direction
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );

  const colorObj = new THREE.Color(color);

  return (
    <group>
      {/* Shaft */}
      {dashed ? (
        <DashedLine from={from} to={[
          from[0] + dir.x * (shaftLen / length),
          from[1] + dir.y * (shaftLen / length),
          from[2] + dir.z * (shaftLen / length),
        ]} color={color} opacity={opacity} />
      ) : (
        <mesh position={midPoint} quaternion={quaternion}>
          <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, shaftLen, SHAFT_SEGMENTS]} />
          <meshStandardMaterial
            color={colorObj}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
      )}

      {/* Cone head */}
      <mesh position={headCenter} quaternion={quaternion}>
        <coneGeometry args={[HEAD_RADIUS, HEAD_LENGTH, SHAFT_SEGMENTS]} />
        <meshStandardMaterial
          color={colorObj}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}

// ─── Dashed line using line segments ───
function DashedLine({ from, to, color, opacity = 1 }: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  opacity?: number;
}) {
  const geo = useMemo(() => {
    const points = [
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ];
    const g = new THREE.BufferGeometry().setFromPoints(points);
    g.computeBoundingSphere();
    return g;
  }, [from, to]);

  const mat = useMemo(() => {
    const m = new THREE.LineDashedMaterial({
      color: new THREE.Color(color),
      dashSize: 0.04,
      gapSize: 0.03,
      transparent: true,
      opacity,
    });
    return m;
  }, [color, opacity]);

  const lineRef = useRef<THREE.Line>(null);
  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.computeLineDistances();
    }
  }, [geo]);

  return <primitive object={new THREE.Line(geo, mat)} ref={lineRef} />;
}

// ─── Word label (Html from drei) ───
function WordLabel({ position, word, color, glow, fontSize }: {
  position: [number, number, number];
  word: string;
  color: string;
  glow?: boolean;
  fontSize?: number;
}) {
  return (
    <Html
      position={position}
      center
      distanceFactor={2.5}
      style={{ pointerEvents: 'none' }}
    >
      <div style={{
        fontFamily: mono,
        fontSize: fontSize ?? 13,
        fontWeight: 700,
        color,
        textShadow: glow
          ? `0 0 8px ${color}, 0 0 16px ${color}`
          : '0 1px 4px rgba(0,0,0,0.8)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}>
        {word}
      </div>
    </Html>
  );
}

// ─── Pulsing glow ring around result point ───
function GlowRing({ position, color }: {
  position: [number, number, number];
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (meshRef.current) {
      const scale = 1 + 0.3 * Math.sin(Date.now() * 0.003);
      meshRef.current.scale.set(scale, scale, scale);
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.15 * Math.sin(Date.now() * 0.003);
    }
  });
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </mesh>
  );
}

// ─── Small sphere at vector tip ───
function VectorTip({ position, color, size }: {
  position: [number, number, number];
  color: string;
  size?: number;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size ?? 0.025, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
    </mesh>
  );
}

// ─── XYZ Axes with labels ───
const AXIS_LENGTH = 1.25;
const AXIS_LABELS: { axis: 'x' | 'y' | 'z'; label: string; color: string }[] = [
  { axis: 'x', label: '차원 1', color: '#ef4444' },
  { axis: 'y', label: '차원 2', color: '#22c55e' },
  { axis: 'z', label: '차원 3', color: '#3b82f6' },
];

function Axes() {
  return (
    <group>
      {AXIS_LABELS.map(({ axis, label, color }) => {
        const dir: [number, number, number] =
          axis === 'x' ? [AXIS_LENGTH, 0, 0]
          : axis === 'y' ? [0, AXIS_LENGTH, 0]
          : [0, 0, AXIS_LENGTH];

        const labelPos: [number, number, number] = [
          dir[0] * 1.1,
          dir[1] * 1.1,
          dir[2] * 1.1,
        ];

        return (
          <group key={axis}>
            <Arrow3D from={[0, 0, 0]} to={dir} color={color} opacity={0.5} />
            <Html position={labelPos} center style={{ pointerEvents: 'none' }}>
              <div style={{
                fontSize: 10,
                fontFamily: mono,
                color,
                opacity: 0.7,
                whiteSpace: 'nowrap',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                userSelect: 'none',
              }}>
                {label}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ─── Floor grid (XZ plane) ───
function FloorGrid() {
  const lines = useMemo(() => {
    const result: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];
    const step = 0.2;
    const min = -0.2;
    const max = 1.2;
    for (let v = min; v <= max + 0.001; v += step) {
      // Lines along X
      result.push({
        start: new THREE.Vector3(v, 0, min),
        end: new THREE.Vector3(v, 0, max),
      });
      // Lines along Z
      result.push({
        start: new THREE.Vector3(min, 0, v),
        end: new THREE.Vector3(max, 0, v),
      });
    }
    return result;
  }, []);

  const geo = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (const line of lines) {
      points.push(line.start, line.end);
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [lines]);

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#475569" transparent opacity={0.15} />
    </lineSegments>
  );
}

// ─── Origin marker ───
function OriginMarker() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[0.015, 8, 8]} />
      <meshBasicMaterial color="#475569" transparent opacity={0.5} />
    </mesh>
  );
}

// ──────────────────────────────────────
// Main 3D Scene
// ──────────────────────────────────────

interface SceneProps {
  analogy: Analogy;
  step: number;
  intermediate: [number, number, number];
  computed: [number, number, number];
}

function VectorScene({ analogy, step, intermediate, computed }: SceneProps) {
  const showA = step >= 0;
  const showSubtract = step >= 1;
  const showMid = step >= 2;
  const showAddC = step >= 3;
  const showResult = step >= 4;

  const origin: [number, number, number] = [0, 0, 0];

  // Label offset: slightly above vector tip
  const labelOffset = (v: [number, number, number]): [number, number, number] => [
    v[0], v[1] + 0.07, v[2],
  ];

  return (
    <>
      <DeltaClamp />

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} />
      <directionalLight position={[-2, 3, -2]} intensity={0.3} />

      {/* Controls */}
      <OrbitControls
        target={[0.5, 0.5, 0.3]}
        enableDamping
        dampingFactor={0.12}
        minDistance={1}
        maxDistance={5}
        enablePan={false}
      />

      {/* Scene elements */}
      <FloorGrid />
      <OriginMarker />
      <Axes />

      {/* ─── Step 0: A vector ─── */}
      {showA && (
        <>
          <Arrow3D from={origin} to={analogy.a.vec} color={C.violet} />
          <VectorTip position={analogy.a.vec} color={C.violet} />
          <WordLabel position={labelOffset(analogy.a.vec)} word={analogy.a.word} color={C.violet} />
        </>
      )}

      {/* ─── Step 1: Show B vector + subtraction dashed line ─── */}
      {showSubtract && (
        <>
          <Arrow3D from={origin} to={analogy.b.vec} color={C.rose} dashed opacity={0.6} />
          <VectorTip position={analogy.b.vec} color={C.rose} size={0.02} />
          <WordLabel position={labelOffset(analogy.b.vec)} word={analogy.b.word} color={C.rose} />
          {/* Dashed line from A tip to intermediate */}
          <Arrow3D from={analogy.a.vec} to={intermediate} color={C.rose} dashed opacity={0.4} />
        </>
      )}

      {/* ─── Step 2: Intermediate result ─── */}
      {showMid && (
        <>
          <Arrow3D from={origin} to={intermediate} color="#64748b" opacity={0.5} />
          <VectorTip position={intermediate} color="#64748b" size={0.02} />
          <WordLabel position={labelOffset(intermediate)} word="중간" color="#94a3b8" fontSize={11} />
        </>
      )}

      {/* ─── Step 3: C vector + addition ─── */}
      {showAddC && (
        <>
          <Arrow3D from={origin} to={analogy.c.vec} color={C.emerald} opacity={0.8} />
          <VectorTip position={analogy.c.vec} color={C.emerald} />
          <WordLabel position={labelOffset(analogy.c.vec)} word={analogy.c.word} color={C.emerald} />
          {/* Dashed line from intermediate to result */}
          <Arrow3D from={intermediate} to={computed} color={C.emerald} dashed opacity={0.4} />
        </>
      )}

      {/* ─── Step 4: Result ─── */}
      {showResult && (
        <>
          <Arrow3D from={origin} to={computed} color={C.amber} />
          <VectorTip position={computed} color={C.amber} size={0.035} />
          <GlowRing position={computed} color={C.amber} />
          <WordLabel
            position={[computed[0], computed[1] + 0.1, computed[2]]}
            word={`= ${analogy.result.word}!`}
            color={C.amber}
            glow
            fontSize={14}
          />
        </>
      )}
    </>
  );
}

// ──────────────────────────────────────
// Text-only fallback (no WebGL)
// ──────────────────────────────────────

function TextFallback({ analogy, step, intermediate, computed }: SceneProps) {
  return (
    <div style={{
      padding: 20,
      background: 'rgba(15,23,42,0.8)',
      borderRadius: 12,
      border: `1px solid ${C.borderLight}`,
      fontFamily: mono,
      fontSize: 13,
      lineHeight: 2,
      color: C.muted,
      minHeight: 240,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', color: C.dim, fontSize: 11, marginBottom: 12 }}>
        WebGL 미지원 -- 텍스트 계산 모드
      </div>
      <div style={{ color: step >= 0 ? C.violet : C.dim, opacity: step >= 0 ? 1 : 0.3 }}>
        {analogy.a.word} = {fmtVec(analogy.a.vec)}
      </div>
      <div style={{ color: step >= 1 ? C.rose : C.dim, opacity: step >= 1 ? 1 : 0.3 }}>
        - {analogy.b.word} = {fmtVec(analogy.b.vec)}
      </div>
      {step >= 2 && (
        <div style={{ borderTop: `1px dashed ${C.dim}`, margin: '4px 0', opacity: 0.4 }} />
      )}
      <div style={{ color: step >= 2 ? C.text : C.dim, opacity: step >= 2 ? 1 : 0.3 }}>
        중간 = {fmtVec(intermediate)}
      </div>
      <div style={{ color: step >= 3 ? C.emerald : C.dim, opacity: step >= 3 ? 1 : 0.3 }}>
        + {analogy.c.word} = {fmtVec(analogy.c.vec)}
      </div>
      {step >= 4 && (
        <>
          <div style={{ borderTop: `1px dashed ${C.amber}`, margin: '4px 0', opacity: 0.4 }} />
          <div style={{ color: C.amber, fontWeight: 700 }}>
            결과 = {fmtVec(computed)} → {analogy.result.word}!
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────
// Main exported component
// ──────────────────────────────────────

export default function VectorArithmetic() {
  const [selectedId, setSelectedId] = useState('royalty');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [webglAvailable] = useState(() => isWebGLAvailable());

  const analogy = useMemo(() => ANALOGIES.find(a => a.id === selectedId)!, [selectedId]);
  const intermediate = useMemo(() => vecSub(analogy.a.vec, analogy.b.vec), [analogy]);
  const computed = useMemo(() => vecAdd(intermediate, analogy.c.vec), [intermediate, analogy]);

  // Animation playback
  useEffect(() => {
    if (!playing) return;
    if (step >= 4) {
      setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      setStep(s => s + 1);
    }, 1200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, step]);

  const handlePlay = useCallback(() => {
    if (step >= 4) setStep(0);
    setPlaying(true);
  }, [step]);

  const handleNext = useCallback(() => {
    setPlaying(false);
    setStep(s => Math.min(s + 1, 4));
  }, []);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setStep(0);
  }, []);

  const handleSelectAnalogy = useCallback((id: string) => {
    setSelectedId(id);
    setStep(0);
    setPlaying(false);
  }, []);

  return (
    <div style={{
      background: `linear-gradient(145deg, ${C.bg}, rgba(10,15,30,0.98))`,
      borderRadius: 20,
      padding: '24px 20px',
      border: `1px solid ${C.border}`,
      maxWidth: 960,
      margin: '2rem auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {/* ─── Header ─── */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 14 }}>&#x1F9EE;</span>
          <span style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
            벡터 연산
          </span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          단어의 의미를 계산하다
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          3D 공간에서 단어 벡터의 덧셈과 뺄셈으로 의미 관계를 찾아보세요
        </p>
      </div>

      {/* ─── Analogy selector ─── */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        {ANALOGIES.map(a => (
          <button
            key={a.id}
            onClick={() => handleSelectAnalogy(a.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: selectedId === a.id
                ? `2px solid ${C.violet}`
                : `1px solid ${C.borderLight}`,
              background: selectedId === a.id
                ? 'rgba(139,92,246,0.15)'
                : 'rgba(30,41,59,0.5)',
              color: selectedId === a.id ? C.violet : C.muted,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* ─── Main content ─── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* ─── 3D Canvas ─── */}
        <div style={{
          flex: '1 1 480px',
          maxWidth: 560,
          position: 'relative',
        }}>
          <div style={{
            width: '100%',
            height: 420,
            borderRadius: 14,
            overflow: 'hidden',
            border: `1px solid ${C.borderLight}`,
            background: 'rgba(5,10,20,0.9)',
          }}>
            {webglAvailable ? (
              <Suspense fallback={
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '100%', color: C.muted, fontSize: 14,
                }}>
                  3D 공간을 불러오는 중...
                </div>
              }>
                <Canvas
                  camera={{ position: [1.5, 1.5, 1.5], fov: 50 }}
                  gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                  dpr={[1, 1.5]}
                  style={{ width: '100%', height: '100%' }}
                >
                  <VectorScene
                    analogy={analogy}
                    step={step}
                    intermediate={intermediate}
                    computed={computed}
                  />
                </Canvas>
              </Suspense>
            ) : (
              <TextFallback
                analogy={analogy}
                step={step}
                intermediate={intermediate}
                computed={computed}
              />
            )}
          </div>

          {/* Canvas hint overlay */}
          {webglAvailable && (
            <div style={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '3px 10px',
              pointerEvents: 'none',
            }}>
              <span style={{ color: C.dim, fontSize: 10 }}>
                드래그: 회전 | 스크롤: 확대/축소
              </span>
            </div>
          )}

          {/* Step indicator */}
          <div style={{
            display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10,
          }}>
            {STEP_LABELS.map((label, i) => (
              <div key={i} style={{
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 600,
                background: i <= step ? 'rgba(139,92,246,0.15)' : 'rgba(30,41,59,0.3)',
                color: i <= step ? C.violet : C.dim,
                border: i === step ? `1px solid ${C.violet}` : '1px solid transparent',
                transition: 'all 0.3s',
              }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Calculation panel ─── */}
        <div style={{ flex: '1 1 300px', maxWidth: 380 }}>
          {/* Calculation steps */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            borderRadius: 14,
            border: `1px solid ${C.borderLight}`,
            padding: 16,
            marginBottom: 14,
          }}>
            <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 12 }}>
              계산 과정
            </div>

            {/* Line: A */}
            <div style={{
              fontFamily: mono, fontSize: 13, lineHeight: 2,
              color: step >= 0 ? C.violet : C.dim,
              opacity: step >= 0 ? 1 : 0.3,
              transition: 'all 0.4s',
            }}>
              <span style={{ display: 'inline-block', width: 70, textAlign: 'right', marginRight: 8 }}>
                {analogy.a.word}
              </span>
              = {fmtVec(analogy.a.vec)}
            </div>

            {/* Line: - B */}
            <div style={{
              fontFamily: mono, fontSize: 13, lineHeight: 2,
              color: step >= 1 ? C.rose : C.dim,
              opacity: step >= 1 ? 1 : 0.3,
              transition: 'all 0.4s',
            }}>
              <span style={{ display: 'inline-block', width: 70, textAlign: 'right', marginRight: 8 }}>
                - {analogy.b.word}
              </span>
              = {fmtVec(analogy.b.vec)}
            </div>

            {/* Separator */}
            <div style={{
              borderBottom: `1px dashed ${step >= 2 ? C.muted : C.dim}`,
              margin: '4px 0',
              opacity: step >= 2 ? 0.6 : 0.2,
              transition: 'all 0.4s',
            }} />

            {/* Line: intermediate */}
            <div style={{
              fontFamily: mono, fontSize: 13, lineHeight: 2,
              color: step >= 2 ? C.text : C.dim,
              opacity: step >= 2 ? 1 : 0.3,
              transition: 'all 0.4s',
            }}>
              <span style={{ display: 'inline-block', width: 70, textAlign: 'right', marginRight: 8 }}>
                중간
              </span>
              = {fmtVec(intermediate)}
            </div>

            {/* Line: + C */}
            <div style={{
              fontFamily: mono, fontSize: 13, lineHeight: 2,
              color: step >= 3 ? C.emerald : C.dim,
              opacity: step >= 3 ? 1 : 0.3,
              transition: 'all 0.4s',
            }}>
              <span style={{ display: 'inline-block', width: 70, textAlign: 'right', marginRight: 8 }}>
                + {analogy.c.word}
              </span>
              = {fmtVec(analogy.c.vec)}
            </div>

            {/* Separator */}
            <div style={{
              borderBottom: `1px dashed ${step >= 4 ? C.amber : C.dim}`,
              margin: '4px 0',
              opacity: step >= 4 ? 0.6 : 0.2,
              transition: 'all 0.4s',
            }} />

            {/* Line: result */}
            <div style={{
              fontFamily: mono, fontSize: 14, lineHeight: 2,
              color: step >= 4 ? C.amber : C.dim,
              fontWeight: step >= 4 ? 700 : 400,
              opacity: step >= 4 ? 1 : 0.3,
              transition: 'all 0.4s',
            }}>
              <span style={{ display: 'inline-block', width: 70, textAlign: 'right', marginRight: 8 }}>
                결과
              </span>
              = {fmtVec(computed)}
              {step >= 4 && (
                <span style={{ color: C.amber, marginLeft: 8 }}>
                  {'\u2192'} {analogy.result.word}!
                </span>
              )}
            </div>

            {/* Match indicator */}
            {step >= 4 && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.2)',
                textAlign: 'center',
              }}>
                <span style={{ color: C.amber, fontSize: 12, fontWeight: 600 }}>
                  {'\u2713'} 계산 결과가 "{analogy.result.word}" 벡터 {fmtVec(analogy.result.vec)}과 일치!
                </span>
              </div>
            )}
          </div>

          {/* Dimension breakdown */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            borderRadius: 14,
            border: `1px solid ${C.borderLight}`,
            padding: 14,
            marginBottom: 14,
          }}>
            <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 10 }}>
              차원별 비교
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['차원 1', '차원 2', '차원 3'].map((dimLabel, d) => (
                <div key={d} style={{
                  flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 10,
                  background: 'rgba(15,23,42,0.5)', border: `1px solid ${C.borderLight}`,
                }}>
                  <div style={{ color: C.dim, fontSize: 9, marginBottom: 6 }}>{dimLabel}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {[
                      { val: analogy.a.vec[d], color: C.violet },
                      { val: analogy.b.vec[d], color: C.rose },
                      { val: analogy.c.vec[d], color: C.emerald },
                      { val: computed[d], color: C.amber },
                    ].map((item, i) => (
                      <div key={i} style={{
                        fontFamily: mono, fontSize: 12, fontWeight: 600,
                        color: item.color, opacity: i <= step ? 1 : 0.2,
                        transition: 'opacity 0.3s',
                      }}>
                        {item.val.toFixed(1)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              onClick={handlePlay}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: `1px solid ${C.violet}`,
                background: playing ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.08)',
                color: C.violet, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {playing ? '\u23F8 일시정지' : '\u25B6 재생'}
            </button>
            <button
              onClick={handleNext}
              disabled={step >= 4}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: `1px solid ${C.borderLight}`,
                background: 'rgba(30,41,59,0.5)',
                color: step >= 4 ? C.dim : C.muted,
                fontSize: 13, fontWeight: 700,
                cursor: step >= 4 ? 'default' : 'pointer',
                opacity: step >= 4 ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              {'\u2192'} 다음 단계
            </button>
            <button
              onClick={handleReset}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: `1px solid ${C.borderLight}`,
                background: 'rgba(30,41,59,0.5)',
                color: C.muted, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {'\u21BA'} 처음부터
            </button>
          </div>

          {/* Explanation */}
          <div style={{
            padding: '14px', borderRadius: 14,
            background: 'rgba(139,92,246,0.06)',
            border: `1px solid rgba(139,92,246,0.15)`,
          }}>
            <div style={{ color: C.violet, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              {'\uD83D\uDCA1'} 이것이 의미하는 것
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
              {analogy.explanation}
            </div>
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(15,23,42,0.5)',
              fontSize: 11, color: C.dim, lineHeight: 1.7,
            }}>
              Word2Vec, GloVe 같은 모델이 학습한 단어 벡터에서 실제로 이런 관계가 나타납니다.
              벡터 공간에서 <strong style={{ color: C.text }}>의미의 방향</strong>이 보존되기 때문입니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
