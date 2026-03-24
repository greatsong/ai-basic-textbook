import { useState, useEffect, useRef, useCallback } from 'react';

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

// ─── Parabola with a slight bump (local min) ───
// f(x) = 0.12*(x-0.5)^2 + 0.3*exp(-(x+2.5)^2/0.8)
// Global min near x=0.5, small bump near x=-2.5
function lossFunc(x: number): number {
  return 0.12 * (x - 0.5) * (x - 0.5) + 0.3 * Math.exp(-((x + 2.5) * (x + 2.5)) / 0.8);
}

function lossGrad(x: number): number {
  const d1 = 0.24 * (x - 0.5);
  const d2 = 0.3 * Math.exp(-((x + 2.5) * (x + 2.5)) / 0.8) * (-2 * (x + 2.5) / 0.8);
  return d1 + d2;
}

// ─── SVG dimensions ───
const SVG_W = 260;
const SVG_H = 170;
const PAD_L = 10;
const PAD_R = 10;
const PAD_T = 28;
const PAD_B = 22;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;

const X_MIN = -5;
const X_MAX = 6;
const X_RANGE = X_MAX - X_MIN;

// Precompute curve
const CURVE_POINTS = 200;
const curveData: { x: number; y: number }[] = [];
let Y_MIN = Infinity;
let Y_MAX = -Infinity;
for (let i = 0; i <= CURVE_POINTS; i++) {
  const xv = X_MIN + (i / CURVE_POINTS) * X_RANGE;
  const yv = lossFunc(xv);
  curveData.push({ x: xv, y: yv });
  if (yv < Y_MIN) Y_MIN = yv;
  if (yv > Y_MAX) Y_MAX = yv;
}
Y_MAX = Y_MAX * 1.1;
const Y_RANGE = Y_MAX - Y_MIN;

function toSvgX(x: number): number {
  return PAD_L + ((x - X_MIN) / X_RANGE) * PLOT_W;
}
function toSvgY(y: number): number {
  return PAD_T + PLOT_H - ((y - Y_MIN) / Y_RANGE) * PLOT_H;
}

const curvePath = curveData.map((p, i) =>
  `${i === 0 ? 'M' : 'L'}${toSvgX(p.x).toFixed(1)},${toSvgY(p.y).toFixed(1)}`
).join(' ');

// Three scenarios
interface Scenario {
  label: string;
  lr: number;
  color: string;
  description: string;
  result: string;
}

const SCENARIOS: Scenario[] = [
  {
    label: '작은 학습률',
    lr: 0.02,
    color: C.blue,
    description: 'lr = 0.02',
    result: '너무 느림!',
  },
  {
    label: '적절한 학습률',
    lr: 0.5,
    color: C.emerald,
    description: 'lr = 0.5',
    result: '빠르게 수렴!',
  },
  {
    label: '큰 학습률',
    lr: 2.5,
    color: C.rose,
    description: 'lr = 2.5',
    result: '발산!',
  },
];

const START_X = -4;
const MAX_STEPS = 80;
const ANIM_INTERVAL = 60; // ms per step

interface BallState {
  x: number;
  step: number;
  trail: number[];
  escaped: boolean;
}

function SinglePanel({ scenario, playing, onFinish }: {
  scenario: Scenario;
  playing: boolean;
  onFinish: () => void;
}) {
  const [ball, setBall] = useState<BallState>({
    x: START_X, step: 0, trail: [START_X], escaped: false,
  });
  const ballRef = useRef(ball);
  ballRef.current = ball;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when playing transitions to true
  useEffect(() => {
    if (playing) {
      const init: BallState = { x: START_X, step: 0, trail: [START_X], escaped: false };
      ballRef.current = init;
      setBall(init);

      timerRef.current = setInterval(() => {
        const b = ballRef.current;
        if (b.step >= MAX_STEPS || b.escaped) {
          if (timerRef.current) clearInterval(timerRef.current);
          onFinish();
          return;
        }

        const grad = lossGrad(b.x);
        let newX = b.x - scenario.lr * grad;

        // Check escape
        const escaped = Math.abs(newX) > X_MAX + 3 || !isFinite(newX);
        if (escaped) newX = b.x; // keep last valid pos

        const newTrail = [...b.trail, newX].slice(-200);
        const newState: BallState = {
          x: escaped ? b.x : newX,
          step: b.step + 1,
          trail: newTrail,
          escaped,
        };
        ballRef.current = newState;
        setBall(newState);

        if (escaped) {
          if (timerRef.current) clearInterval(timerRef.current);
          onFinish();
        }
      }, ANIM_INTERVAL);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [playing, scenario.lr, onFinish]);

  // Converged check
  const converged = !ball.escaped && ball.step > 5 && Math.abs(lossGrad(ball.x)) < 0.05;
  const currentLoss = lossFunc(ball.x);

  // Ball SVG position
  const bx = toSvgX(ball.x);
  const by = toSvgY(currentLoss);

  return (
    <div style={{
      flex: '1 1 240px', minWidth: 220, maxWidth: 320,
      background: C.card, borderRadius: 14,
      border: `1px solid ${C.borderLight}`,
      padding: '10px 8px 12px',
    }}>
      {/* Label */}
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 99,
          background: `${scenario.color}18`, border: `1px solid ${scenario.color}40`,
          color: scenario.color, fontSize: 12, fontWeight: 700,
        }}>
          {scenario.label}
        </span>
        <div style={{ color: C.dim, fontSize: 11, fontFamily: mono, marginTop: 3 }}>
          {scenario.description}
        </div>
      </div>

      {/* SVG */}
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Background grid */}
        {[0.5, 1.0, 1.5, 2.0].map(v => {
          if (v > Y_MAX || v < Y_MIN) return null;
          const py = toSvgY(v);
          return (
            <line key={v} x1={PAD_L} y1={py} x2={SVG_W - PAD_R} y2={py}
              stroke="rgba(100,116,139,0.15)" strokeWidth={0.5} strokeDasharray="4,4" />
          );
        })}

        {/* Curve */}
        <path d={curvePath} fill="none" stroke="rgba(148,163,184,0.4)" strokeWidth={2} />

        {/* Fill under curve */}
        <path
          d={`${curvePath} L${toSvgX(X_MAX)},${PAD_T + PLOT_H} L${toSvgX(X_MIN)},${PAD_T + PLOT_H} Z`}
          fill="rgba(100,116,139,0.05)"
        />

        {/* Trail dots */}
        {ball.trail.map((tx, i) => {
          if (i === ball.trail.length - 1) return null;
          const opacity = 0.1 + (i / ball.trail.length) * 0.4;
          const ty = lossFunc(tx);
          const px = toSvgX(tx);
          const py = toSvgY(ty);
          if (px < PAD_L || px > SVG_W - PAD_R) return null;
          return (
            <circle key={i} cx={px} cy={py} r={2}
              fill={scenario.color} opacity={opacity} />
          );
        })}

        {/* Current ball */}
        {!ball.escaped && (
          <g>
            <circle cx={bx} cy={by} r={10}
              fill={scenario.color} opacity={0.15} />
            <circle cx={bx} cy={by} r={5}
              fill={scenario.color} stroke="#fff" strokeWidth={1.5} />
          </g>
        )}

        {/* Escaped indicator */}
        {ball.escaped && (
          <text x={SVG_W / 2} y={PAD_T + PLOT_H / 2} textAnchor="middle"
            fill={C.rose} fontSize={20} fontWeight={700} opacity={0.8}>
            💥 발산!
          </text>
        )}

        {/* Converged indicator */}
        {converged && (
          <text x={bx} y={by - 14} textAnchor="middle"
            fill={C.emerald} fontSize={10} fontWeight={700}>
            수렴!
          </text>
        )}

        {/* Step counter */}
        <text x={SVG_W - PAD_R - 4} y={PAD_T + 12} textAnchor="end"
          fill={C.dim} fontSize={10} fontFamily={mono}>
          스텝: {ball.step}
        </text>

        {/* Loss label */}
        <text x={PAD_L + 4} y={PAD_T + 12} textAnchor="start"
          fill={C.dim} fontSize={10} fontFamily={mono}>
          손실: {currentLoss.toFixed(3)}
        </text>

        {/* Axis labels */}
        <text x={SVG_W / 2} y={SVG_H - 4} textAnchor="middle"
          fill={C.dim} fontSize={10}>파라미터 w</text>
      </svg>

      {/* Result */}
      <div style={{
        textAlign: 'center', marginTop: 6,
        color: ball.escaped ? C.rose : converged ? C.emerald : ball.step >= MAX_STEPS ? C.amber : C.dim,
        fontSize: 12, fontWeight: 600,
        minHeight: 18,
      }}>
        {ball.escaped ? scenario.result :
         converged ? scenario.result :
         ball.step >= MAX_STEPS ? '아직 수렴 안 됨...' :
         playing ? '이동 중...' : '대기 중'}
      </div>
    </div>
  );
}

export default function LearningRateComparison() {
  const [playing, setPlaying] = useState(false);
  const finishedCount = useRef(0);

  const handleStart = useCallback(() => {
    finishedCount.current = 0;
    setPlaying(false);
    // Force re-mount by toggling
    requestAnimationFrame(() => setPlaying(true));
  }, []);

  const handleFinish = useCallback(() => {
    finishedCount.current += 1;
    if (finishedCount.current >= 3) {
      // All done
    }
  }, []);

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
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 6,
        }}>
          <span style={{ fontSize: 14 }}>⚖️</span>
          <span style={{ color: '#67e8f9', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
            학습률 비교
          </span>
        </div>
        <h3 style={{ color: C.text, fontSize: 18, fontWeight: 700, margin: '4px 0 2px' }}>
          학습률이 다르면 어떻게 달라질까?
        </h3>
        <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
          같은 출발점에서 학습률만 바꿔 경사하강법을 실행합니다
        </p>
      </div>

      {/* Three panels */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {SCENARIOS.map((s, i) => (
          <SinglePanel key={`${i}-${playing}`} scenario={s} playing={playing} onFinish={handleFinish} />
        ))}
      </div>

      {/* Button */}
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button onClick={handleStart} style={{
          padding: '10px 32px', borderRadius: 12,
          background: 'rgba(6,182,212,0.12)', border: `1px solid ${C.cyan}`,
          color: C.cyan, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          {playing ? '↺ 다시 시작' : '▶ 세 공을 동시에 출발시키기'}
        </button>
      </div>

      {/* Educational note */}
      <div style={{
        marginTop: 12, padding: '12px 16px', borderRadius: 12,
        background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.blue }}>작은 학습률</strong>은 안전하지만 느리고,{' '}
          <strong style={{ color: C.emerald }}>적절한 학습률</strong>은 빠르게 수렴하며,{' '}
          <strong style={{ color: C.rose }}>큰 학습률</strong>은 최적점을 지나쳐 발산합니다.
        </div>
      </div>
    </div>
  );
}
