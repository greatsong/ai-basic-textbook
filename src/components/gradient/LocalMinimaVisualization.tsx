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

// ─── Loss function with two minima ───
// A curve with a local minimum (shallow) and a global minimum (deep)
// f(x) = 0.03*(x+1)^4 - 0.4*(x+1)^2 + 0.1*x + 1.5
//        + -0.8*exp(-(x-3)^2/1.2)  ← global minimum around x=3
//        + -0.5*exp(-(x+3)^2/1.0)  ← local minimum around x=-3
function lossFunc(x: number): number {
  const base = 0.008 * Math.pow(x, 4) - 0.12 * x * x + 0.5;
  const globalWell = -1.2 * Math.exp(-((x - 3.5) * (x - 3.5)) / 1.5);
  const localWell = -0.6 * Math.exp(-((x + 2.5) * (x + 2.5)) / 1.2);
  return base + globalWell + localWell + 1.5;
}

function lossGrad(x: number): number {
  const d1 = 0.032 * Math.pow(x, 3) - 0.24 * x;
  const d2 = -1.2 * Math.exp(-((x - 3.5) * (x - 3.5)) / 1.5) * (-2 * (x - 3.5) / 1.5);
  const d3 = -0.6 * Math.exp(-((x + 2.5) * (x + 2.5)) / 1.2) * (-2 * (x + 2.5) / 1.2);
  return d1 + d2 + d3;
}

// ─── SVG dimensions ───
const SVG_W = 560;
const SVG_H = 260;
const PAD_L = 40;
const PAD_R = 20;
const PAD_T = 30;
const PAD_B = 30;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;

const X_MIN = -6;
const X_MAX = 7;
const X_RANGE = X_MAX - X_MIN;

// Precompute curve
const CURVE_N = 300;
const curveData: { x: number; y: number }[] = [];
let Y_MIN_RAW = Infinity;
let Y_MAX_RAW = -Infinity;
for (let i = 0; i <= CURVE_N; i++) {
  const xv = X_MIN + (i / CURVE_N) * X_RANGE;
  const yv = lossFunc(xv);
  curveData.push({ x: xv, y: yv });
  if (yv < Y_MIN_RAW) Y_MIN_RAW = yv;
  if (yv > Y_MAX_RAW) Y_MAX_RAW = yv;
}
const Y_MIN = Y_MIN_RAW - 0.1;
const Y_MAX = Y_MAX_RAW * 1.05;
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

// Find minima positions for labels
const globalMinX = 3.5; // approximate
const localMinX = -2.5; // approximate
const globalMinY = lossFunc(globalMinX);
const localMinY = lossFunc(localMinX);

const START_X = -5.5;
const MAX_STEPS = 300;
const ANIM_INTERVAL = 40;

interface BallState {
  x: number;
  vx: number;
  step: number;
  trail: number[];
  status: 'idle' | 'running' | 'converged' | 'local' | 'escaped';
}

export default function LocalMinimaVisualization() {
  const [useMomentum, setUseMomentum] = useState(false);
  const [lr] = useState(0.3);
  const [momentumVal] = useState(0.9);
  const [playing, setPlaying] = useState(false);

  const [ball, setBall] = useState<BallState>({
    x: START_X, vx: 0, step: 0, trail: [START_X], status: 'idle',
  });
  const ballRef = useRef(ball);
  ballRef.current = ball;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    const init: BallState = { x: START_X, vx: 0, step: 0, trail: [START_X], status: 'idle' };
    ballRef.current = init;
    setBall(init);
    setPlaying(false);
  }, [cleanup]);

  // Reset when momentum toggle changes
  useEffect(() => {
    reset();
  }, [useMomentum, reset]);

  const start = useCallback(() => {
    cleanup();
    const init: BallState = { x: START_X, vx: 0, step: 0, trail: [START_X], status: 'running' };
    ballRef.current = init;
    setBall(init);
    setPlaying(true);

    timerRef.current = setInterval(() => {
      const b = ballRef.current;
      if (b.status !== 'running' || b.step >= MAX_STEPS) {
        cleanup();
        return;
      }

      const grad = lossGrad(b.x);
      let newVx: number;
      let newX: number;

      if (useMomentum) {
        // GD with momentum
        newVx = momentumVal * b.vx - lr * grad;
        newX = b.x + newVx;
      } else {
        // Vanilla GD
        newVx = 0;
        newX = b.x - lr * grad;
      }

      // Escape check
      if (Math.abs(newX) > X_MAX + 2 || !isFinite(newX)) {
        const escaped: BallState = { ...b, status: 'escaped', step: b.step + 1 };
        ballRef.current = escaped;
        setBall(escaped);
        cleanup();
        return;
      }

      // Convergence check
      const gradMag = Math.abs(lossGrad(newX));
      let status: BallState['status'] = 'running';

      if (gradMag < 0.02 && b.step > 10) {
        // Near which minimum?
        const distGlobal = Math.abs(newX - globalMinX);
        const distLocal = Math.abs(newX - localMinX);
        if (distGlobal < 1.5) {
          status = 'converged';
        } else if (distLocal < 1.5) {
          status = 'local';
        } else {
          status = 'converged'; // some other critical point
        }
      }

      const newTrail = [...b.trail, newX].slice(-500);
      const newState: BallState = {
        x: newX, vx: newVx, step: b.step + 1, trail: newTrail, status,
      };
      ballRef.current = newState;
      setBall(newState);

      if (status !== 'running') {
        cleanup();
      }
    }, ANIM_INTERVAL);
  }, [useMomentum, lr, momentumVal, cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const currentLoss = lossFunc(ball.x);
  const bx = toSvgX(ball.x);
  const by = toSvgY(currentLoss);

  const getMessage = () => {
    switch (ball.status) {
      case 'converged':
        return { text: '글로벌 미니멈에 도달!', color: C.emerald, icon: '🎉' };
      case 'local':
        return { text: '로컬 미니멈에 빠짐 — 모멘텀을 켜보세요!', color: C.amber, icon: '⚠️' };
      case 'escaped':
        return { text: '발산했습니다!', color: C.rose, icon: '💥' };
      case 'running':
        return { text: '경사를 따라 내려가는 중...', color: C.cyan, icon: '⏳' };
      default:
        return { text: '출발 버튼을 눌러보세요', color: C.muted, icon: '💡' };
    }
  };

  const msg = getMessage();

  return (
    <div style={{
      background: `linear-gradient(145deg, ${C.bg}, rgba(10,15,30,0.98))`,
      borderRadius: 20,
      padding: '20px 16px 16px',
      border: `1px solid ${C.border}`,
      maxWidth: 700,
      margin: '2rem auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 6,
        }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <span style={{ color: '#fcd34d', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
            로컬 미니마와 모멘텀
          </span>
        </div>
        <h3 style={{ color: C.text, fontSize: 18, fontWeight: 700, margin: '4px 0 2px' }}>
          모멘텀이 로컬 미니마를 탈출하는 원리
        </h3>
        <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
          모멘텀 없이는 얕은 웅덩이에 빠지지만, 모멘텀이 있으면 관성으로 넘어갑니다
        </p>
      </div>

      {/* Momentum toggle */}
      <div style={{
        display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14,
      }}>
        <button onClick={() => setUseMomentum(false)} style={{
          padding: '8px 20px', borderRadius: 10,
          border: `1px solid ${!useMomentum ? C.blue : C.borderLight}`,
          background: !useMomentum ? 'rgba(59,130,246,0.12)' : 'rgba(30,41,59,0.5)',
          color: !useMomentum ? C.blue : C.muted,
          fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
        }}>
          🐢 모멘텀 OFF (기본 GD)
        </button>
        <button onClick={() => setUseMomentum(true)} style={{
          padding: '8px 20px', borderRadius: 10,
          border: `1px solid ${useMomentum ? C.emerald : C.borderLight}`,
          background: useMomentum ? 'rgba(16,185,129,0.12)' : 'rgba(30,41,59,0.5)',
          color: useMomentum ? C.emerald : C.muted,
          fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
        }}>
          🚀 모멘텀 ON (momentum=0.9)
        </button>
      </div>

      {/* SVG Visualization */}
      <div style={{
        background: C.card, borderRadius: 14,
        border: `1px solid ${C.borderLight}`, padding: '8px 6px',
      }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Grid lines */}
          {[0.5, 1.0, 1.5, 2.0, 2.5].map(v => {
            if (v > Y_MAX || v < Y_MIN) return null;
            const py = toSvgY(v);
            return (
              <g key={v}>
                <line x1={PAD_L} y1={py} x2={SVG_W - PAD_R} y2={py}
                  stroke="rgba(100,116,139,0.15)" strokeWidth={0.5} strokeDasharray="4,4" />
                <text x={PAD_L - 6} y={py + 3} textAnchor="end"
                  fill={C.dim} fontSize={9} fontFamily={mono}>{v.toFixed(1)}</text>
              </g>
            );
          })}

          {/* Fill under curve */}
          <path
            d={`${curvePath} L${toSvgX(X_MAX)},${PAD_T + PLOT_H} L${toSvgX(X_MIN)},${PAD_T + PLOT_H} Z`}
            fill="rgba(100,116,139,0.04)"
          />

          {/* Curve */}
          <path d={curvePath} fill="none" stroke="rgba(148,163,184,0.5)" strokeWidth={2.5} />

          {/* Local minimum zone highlight */}
          <rect
            x={toSvgX(localMinX - 1.2)} y={PAD_T}
            width={(1.2 * 2 / X_RANGE) * PLOT_W} height={PLOT_H}
            fill="rgba(245,158,11,0.06)" rx={8}
          />
          <text x={toSvgX(localMinX)} y={PAD_T + 14} textAnchor="middle"
            fill={C.amber} fontSize={10} fontWeight={600}>
            로컬 미니멈
          </text>
          <text x={toSvgX(localMinX)} y={PAD_T + 26} textAnchor="middle"
            fill={C.dim} fontSize={9} fontFamily={mono}>
            (얕은 웅덩이)
          </text>

          {/* Global minimum zone highlight */}
          <rect
            x={toSvgX(globalMinX - 1.2)} y={PAD_T}
            width={(1.2 * 2 / X_RANGE) * PLOT_W} height={PLOT_H}
            fill="rgba(16,185,129,0.06)" rx={8}
          />
          <text x={toSvgX(globalMinX)} y={PAD_T + 14} textAnchor="middle"
            fill={C.emerald} fontSize={10} fontWeight={600}>
            글로벌 미니멈
          </text>
          <text x={toSvgX(globalMinX)} y={PAD_T + 26} textAnchor="middle"
            fill={C.dim} fontSize={9} fontFamily={mono}>
            (진짜 최적점)
          </text>

          {/* Global min marker */}
          <circle cx={toSvgX(globalMinX)} cy={toSvgY(globalMinY)} r={6}
            fill="none" stroke={C.emerald} strokeWidth={1.5} opacity={0.6} />
          <circle cx={toSvgX(globalMinX)} cy={toSvgY(globalMinY)} r={2}
            fill={C.emerald} opacity={0.8} />

          {/* Local min marker */}
          <circle cx={toSvgX(localMinX)} cy={toSvgY(localMinY)} r={6}
            fill="none" stroke={C.amber} strokeWidth={1.5} opacity={0.6} />
          <circle cx={toSvgX(localMinX)} cy={toSvgY(localMinY)} r={2}
            fill={C.amber} opacity={0.8} />

          {/* Start position marker */}
          <line x1={toSvgX(START_X)} y1={PAD_T} x2={toSvgX(START_X)} y2={PAD_T + PLOT_H}
            stroke="rgba(148,163,184,0.2)" strokeWidth={1} strokeDasharray="3,3" />
          <text x={toSvgX(START_X)} y={PAD_T + PLOT_H + 14} textAnchor="middle"
            fill={C.dim} fontSize={9}>출발</text>

          {/* Trail */}
          {ball.trail.length > 1 && ball.trail.map((tx, i) => {
            if (i === ball.trail.length - 1) return null;
            const opacity = 0.1 + (i / ball.trail.length) * 0.5;
            const ty = lossFunc(tx);
            const px = toSvgX(tx);
            const py = toSvgY(ty);
            if (px < PAD_L - 5 || px > SVG_W - PAD_R + 5) return null;
            return (
              <circle key={i} cx={px} cy={py} r={1.5}
                fill={useMomentum ? C.emerald : C.blue} opacity={opacity} />
            );
          })}

          {/* Ball */}
          {ball.status !== 'escaped' && (
            <g>
              <circle cx={bx} cy={by} r={14}
                fill={useMomentum ? C.emerald : C.blue} opacity={0.12} />
              <circle cx={bx} cy={by} r={7}
                fill={useMomentum ? C.emerald : C.blue}
                stroke="#fff" strokeWidth={2} />

              {/* Velocity arrow for momentum */}
              {useMomentum && Math.abs(ball.vx) > 0.01 && ball.status === 'running' && (() => {
                const arrowLen = Math.min(Math.abs(ball.vx) * 30, 60);
                const dir = ball.vx > 0 ? 1 : -1;
                return (
                  <g>
                    <line
                      x1={bx} y1={by - 16}
                      x2={bx + dir * arrowLen} y2={by - 16}
                      stroke={C.emerald} strokeWidth={2.5} strokeLinecap="round"
                    />
                    <polygon
                      points={`${bx + dir * arrowLen},${by - 22} ${bx + dir * arrowLen},${by - 10} ${bx + dir * (arrowLen + 8)},${by - 16}`}
                      fill={C.emerald} opacity={0.8}
                    />
                    <text x={bx + dir * arrowLen / 2} y={by - 24}
                      textAnchor="middle" fill={C.emerald} fontSize={8} fontWeight={600}>
                      관성
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Axis labels */}
          <text x={SVG_W / 2} y={SVG_H - 6} textAnchor="middle"
            fill={C.muted} fontSize={11}>파라미터 w</text>
          <text x={10} y={SVG_H / 2} textAnchor="middle"
            fill={C.muted} fontSize={11}
            transform={`rotate(-90, 10, ${SVG_H / 2})`}>손실</text>
        </svg>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14,
      }}>
        <button onClick={start} style={{
          padding: '10px 28px', borderRadius: 12,
          background: 'rgba(6,182,212,0.12)', border: `1px solid ${C.cyan}`,
          color: C.cyan, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          {playing ? '↺ 다시 시작' : '▶ 출발!'}
        </button>
        <button onClick={reset} style={{
          padding: '10px 20px', borderRadius: 12,
          background: 'rgba(30,41,59,0.5)', border: `1px solid ${C.borderLight}`,
          color: C.muted, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          ↺ 리셋
        </button>
      </div>

      {/* Status + stats */}
      <div style={{
        display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <div style={{
          padding: '6px 14px', borderRadius: 10,
          background: 'rgba(30,41,59,0.5)', border: `1px solid ${C.borderLight}`,
        }}>
          <span style={{ color: C.dim, fontSize: 11 }}>스텝: </span>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.text }}>{ball.step}</span>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: 10,
          background: 'rgba(30,41,59,0.5)', border: `1px solid ${C.borderLight}`,
        }}>
          <span style={{ color: C.dim, fontSize: 11 }}>손실: </span>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.text }}>{currentLoss.toFixed(3)}</span>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: 10,
          background: 'rgba(30,41,59,0.5)', border: `1px solid ${C.borderLight}`,
        }}>
          <span style={{ color: C.dim, fontSize: 11 }}>위치: </span>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.text }}>w = {ball.x.toFixed(2)}</span>
        </div>
      </div>

      {/* Educational message */}
      <div style={{
        marginTop: 10, padding: '10px 16px', borderRadius: 12,
        background: ball.status === 'converged' ? 'rgba(16,185,129,0.08)' :
                    ball.status === 'local' ? 'rgba(245,158,11,0.08)' :
                    'rgba(30,41,59,0.4)',
        border: `1px solid ${ball.status === 'converged' ? 'rgba(16,185,129,0.2)' :
                              ball.status === 'local' ? 'rgba(245,158,11,0.2)' :
                              C.borderLight}`,
        textAlign: 'center',
      }}>
        <span style={{ color: msg.color, fontSize: 14, fontWeight: 600 }}>
          {msg.icon} {msg.text}
        </span>
      </div>

      {/* Explanation */}
      <div style={{
        marginTop: 12, padding: '14px 16px', borderRadius: 12,
        background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
      }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
          <strong style={{ color: C.violet }}>모멘텀(Momentum)</strong>은 이전 이동 방향의 관성을 유지합니다.
          <br />
          <span style={{ color: C.amber }}>로컬 미니멈</span> 근처에서 기울기가 0에 가까워져도,
          축적된 속도 덕분에 웅덩이를 넘어{' '}
          <span style={{ color: C.emerald }}>글로벌 미니멈</span>까지 도달할 수 있습니다.
          <br />
          <span style={{ color: C.dim }}>수식: v = momentum * v - lr * gradient, &nbsp; w = w + v</span>
        </div>
      </div>
    </div>
  );
}
