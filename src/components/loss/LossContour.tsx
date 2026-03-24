import { useState, useMemo, useRef, useCallback } from 'react';

// ─── Color constants (2차시 동일 다크 테마) ───
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

// ─── 데이터 (라운드 1과 동일) ───
interface DataPoint { x: number; y: number }
const DATA: DataPoint[] = [
  { x: 0.5, y: 2.8 }, { x: 1.0, y: 3.6 }, { x: 1.5, y: 4.2 },
  { x: 2.0, y: 5.1 }, { x: 2.5, y: 5.7 }, { x: 3.0, y: 6.5 },
  { x: 3.5, y: 7.2 }, { x: 4.0, y: 8.0 }, { x: 4.5, y: 8.9 },
  { x: 5.0, y: 9.5 },
];

// ─── MSE 계산 ───
function computeMSE(w: number, b: number, data: DataPoint[]): number {
  return data.reduce((sum, p) => {
    const err = (w * p.x + b) - p.y;
    return sum + err * err;
  }, 0) / data.length;
}

// ─── 기울기 (Gradient) 계산 ───
function computeGradient(w: number, b: number, data: DataPoint[]): { dw: number; db: number } {
  const n = data.length;
  let dw = 0, db = 0;
  for (const p of data) {
    const err = (w * p.x + b) - p.y;
    dw += 2 * err * p.x;
    db += 2 * err;
  }
  return { dw: dw / n, db: db / n };
}

// ─── 최적점 계산 ───
function computeOptimal(data: DataPoint[]): { w: number; b: number } {
  const n = data.length;
  const sumX = data.reduce((s, p) => s + p.x, 0);
  const sumY = data.reduce((s, p) => s + p.y, 0);
  const sumXY = data.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = data.reduce((s, p) => s + p.x * p.x, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  const wOpt = (sumXY - n * meanX * meanY) / (sumX2 - n * meanX * meanX);
  const bOpt = meanY - wOpt * meanX;
  return { w: wOpt, b: bOpt };
}

// ─── SVG dimensions ───
const SVG_SIZE = 380;
const PAD = 50;
const plotSize = SVG_SIZE - 2 * PAD;

// ─── w, b 범위 ───
const W_MIN = -1;
const W_MAX = 4;
const B_MIN = -3;
const B_MAX = 8;
const W_RANGE = W_MAX - W_MIN;
const B_RANGE = B_MAX - B_MIN;

// 등고선 그리드 해상도
const GRID_RES = 60;

function toSvgX(w: number) {
  return PAD + ((w - W_MIN) / W_RANGE) * plotSize;
}
function toSvgY(b: number) {
  // b축은 아래에서 위로 증가
  return PAD + plotSize - ((b - B_MIN) / B_RANGE) * plotSize;
}
function fromSvgX(sx: number) {
  return W_MIN + ((sx - PAD) / plotSize) * W_RANGE;
}
function fromSvgY(sy: number) {
  return B_MIN + ((PAD + plotSize - sy) / plotSize) * B_RANGE;
}

// ─── 색상 보간: 빨강(높음) → 노랑 → 파랑(낮음) ───
function lossToColor(mse: number, maxMSE: number): string {
  const t = Math.min(mse / maxMSE, 1); // 0(낮음) ~ 1(높음)
  // 파랑 → 청록 → 노랑 → 빨강
  if (t < 0.25) {
    const s = t / 0.25;
    // 진한 파랑 → 청록
    const r = Math.round(10 + s * 0);
    const g = Math.round(40 + s * 160);
    const b = Math.round(180 + s * (220 - 180));
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    // 청록 → 초록/노랑
    const r = Math.round(10 + s * 180);
    const g = Math.round(200 - s * 10);
    const b = Math.round(220 - s * 180);
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    // 노랑 → 주황
    const r = Math.round(190 + s * 50);
    const g = Math.round(190 - s * 100);
    const b = Math.round(40 - s * 20);
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.75) / 0.25;
    // 주황 → 빨강
    const r = Math.round(240 - s * 20);
    const g = Math.round(90 - s * 70);
    const b = Math.round(20 + s * 10);
    return `rgb(${r},${g},${b})`;
  }
}

export default function LossContour() {
  const [w, setW] = useState(0.5);
  const [b, setB] = useState(1.0);
  const [showGradient, setShowGradient] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const optimal = useMemo(() => computeOptimal(DATA), []);
  const currentMSE = useMemo(() => computeMSE(w, b, DATA), [w, b]);
  const gradient = useMemo(() => computeGradient(w, b, DATA), [w, b]);
  const optimalMSE = useMemo(() => computeMSE(optimal.w, optimal.b, DATA), [optimal]);

  // 등고선 그리드 데이터 계산
  const { grid, maxMSE } = useMemo(() => {
    const g: number[][] = [];
    let mx = 0;
    for (let j = 0; j < GRID_RES; j++) {
      g[j] = [];
      for (let i = 0; i < GRID_RES; i++) {
        const wVal = W_MIN + (i / (GRID_RES - 1)) * W_RANGE;
        const bVal = B_MIN + (j / (GRID_RES - 1)) * B_RANGE;
        const mse = computeMSE(wVal, bVal, DATA);
        g[j][i] = mse;
        if (mse > mx) mx = mse;
      }
    }
    // Cap maxMSE for better color distribution
    return { grid: g, maxMSE: Math.min(mx, 80) };
  }, []);

  // 등고선 레벨
  const contourLevels = useMemo(() => {
    const levels = [0.5, 1, 2, 4, 8, 16, 32, 64];
    return levels.filter(l => l < maxMSE);
  }, [maxMSE]);

  // SVG 클릭으로 위치 이동
  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_SIZE / rect.width;
    const scaleY = SVG_SIZE / rect.height;
    const sx = (e.clientX - rect.left) * scaleX;
    const sy = (e.clientY - rect.top) * scaleY;
    const newW = fromSvgX(sx);
    const newB = fromSvgY(sy);
    if (newW >= W_MIN && newW <= W_MAX && newB >= B_MIN && newB <= B_MAX) {
      setW(Math.round(newW * 10) / 10);
      setB(Math.round(newB * 10) / 10);
    }
  }, []);

  // 기울기 화살표 계산
  const arrowScale = 3; // 화살표 크기 스케일
  const gradMag = Math.sqrt(gradient.dw * gradient.dw + gradient.db * gradient.db);
  const normDw = gradMag > 0.01 ? -gradient.dw / gradMag : 0;
  const normDb = gradMag > 0.01 ? -gradient.db / gradMag : 0;
  const arrowLen = Math.min(gradMag * arrowScale, 40);

  // MSE 수준 판단
  const mseLevel = currentMSE < optimalMSE * 1.05 ? 'excellent'
    : currentMSE < optimalMSE * 1.5 ? 'good'
    : currentMSE < optimalMSE * 3 ? 'ok'
    : 'poor';
  const mseLevelColor = {
    excellent: C.emerald, good: C.cyan, ok: C.amber, poor: C.rose,
  };

  // 셀 크기
  const cellW = plotSize / GRID_RES;
  const cellH = plotSize / GRID_RES;

  return (
    <div style={{
      background: `linear-gradient(145deg, ${C.bg}, rgba(10,15,30,0.98))`,
      borderRadius: 20,
      padding: '24px 20px',
      border: `1px solid ${C.border}`,
      maxWidth: 900,
      margin: '2rem auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {/* ─── Header ─── */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 14 }}>🗺️</span>
          <span style={{ color: '#93c5fd', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>손실 등고선</span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          가장 파란 곳을 찾아가세요 — 그곳이 최적점입니다
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          등고선 위를 클릭하거나 슬라이더로 w, b를 조절하세요
        </p>
      </div>

      {/* ─── Main content ─── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* ─── Contour Map ─── */}
        <div style={{
          background: C.card,
          borderRadius: 16,
          border: `1px solid ${C.borderLight}`,
          padding: 12,
          flex: '1 1 400px',
          maxWidth: 420,
        }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
            onClick={handleSvgClick}
          >
            {/* 히트맵 셀 */}
            {grid.map((row, j) =>
              row.map((mse, i) => (
                <rect
                  key={`c-${j}-${i}`}
                  x={PAD + i * cellW}
                  y={PAD + j * cellH}
                  width={cellW + 0.5}
                  height={cellH + 0.5}
                  fill={lossToColor(mse, maxMSE)}
                  opacity={0.85}
                />
              ))
            )}

            {/* 등고선 라벨 */}
            {contourLevels.map(level => {
              // 등고선 위에 라벨 표시를 위한 간단한 위치 계산
              // w축의 중간에서 해당 MSE가 되는 b를 찾아 라벨 배치
              const wMid = (W_MIN + W_MAX) / 2;
              // MSE = level 이 되는 지점을 대략 찾기
              for (let bTest = B_MIN; bTest <= B_MAX; bTest += 0.2) {
                const testMSE = computeMSE(wMid, bTest, DATA);
                if (Math.abs(testMSE - level) < level * 0.15) {
                  const sx = toSvgX(wMid);
                  const sy = toSvgY(bTest);
                  if (sy > PAD + 10 && sy < PAD + plotSize - 10) {
                    return (
                      <text
                        key={`cl-${level}`}
                        x={sx} y={sy}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="rgba(255,255,255,0.5)" fontSize={9} fontFamily={mono}
                      >
                        {level}
                      </text>
                    );
                  }
                  break;
                }
              }
              return null;
            })}

            {/* 최적점 표시 */}
            <circle
              cx={toSvgX(optimal.w)} cy={toSvgY(optimal.b)} r={6}
              fill="none" stroke="#fff" strokeWidth={2} opacity={0.4}
            />
            <circle
              cx={toSvgX(optimal.w)} cy={toSvgY(optimal.b)} r={2}
              fill="#fff" opacity={0.5}
            />

            {/* 기울기 화살표 */}
            {showGradient && gradMag > 0.01 && (
              <g>
                {/* 화살표 본체 */}
                <line
                  x1={toSvgX(w)}
                  y1={toSvgY(b)}
                  x2={toSvgX(w) + normDw * arrowLen}
                  y2={toSvgY(b) - normDb * arrowLen}
                  stroke={C.emerald}
                  strokeWidth={3}
                  strokeLinecap="round"
                  markerEnd="url(#arrowHead)"
                />
                {/* 화살표 머리 */}
                <defs>
                  <marker id="arrowHead" markerWidth="10" markerHeight="10"
                    refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill={C.emerald} />
                  </marker>
                </defs>
              </g>
            )}

            {/* 현재 위치 점 */}
            <circle
              cx={toSvgX(w)} cy={toSvgY(b)} r={8}
              fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth={2.5}
            />
            <circle
              cx={toSvgX(w)} cy={toSvgY(b)} r={3.5}
              fill="#fff"
            />

            {/* 축 라벨 */}
            {[0, 1, 2, 3, 4].filter(v => v >= W_MIN && v <= W_MAX).map(v => (
              <text key={`wl-${v}`} x={toSvgX(v)} y={SVG_SIZE - 14}
                textAnchor="middle" fill={C.dim} fontSize={11} fontFamily={mono}>{v}</text>
            ))}
            {[-2, 0, 2, 4, 6, 8].filter(v => v >= B_MIN && v <= B_MAX).map(v => (
              <text key={`bl-${v}`} x={PAD - 10} y={toSvgY(v) + 4}
                textAnchor="end" fill={C.dim} fontSize={11} fontFamily={mono}>{v}</text>
            ))}

            <text x={SVG_SIZE / 2} y={SVG_SIZE - 2} textAnchor="middle"
              fill={C.muted} fontSize={13} fontWeight={600}>w (기울기)</text>
            <text x={10} y={SVG_SIZE / 2} textAnchor="middle"
              fill={C.muted} fontSize={13} fontWeight={600}
              transform={`rotate(-90, 10, ${SVG_SIZE / 2})`}>b (절편)</text>

            {/* 색상 범례 */}
            <defs>
              <linearGradient id="legendGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={lossToColor(0, maxMSE)} />
                <stop offset="25%" stopColor={lossToColor(maxMSE * 0.25, maxMSE)} />
                <stop offset="50%" stopColor={lossToColor(maxMSE * 0.5, maxMSE)} />
                <stop offset="75%" stopColor={lossToColor(maxMSE * 0.75, maxMSE)} />
                <stop offset="100%" stopColor={lossToColor(maxMSE, maxMSE)} />
              </linearGradient>
            </defs>
            <rect x={PAD} y={PAD - 18} width={80} height={8} rx={3}
              fill="url(#legendGrad)" />
            <text x={PAD - 2} y={PAD - 22} fill={C.dim} fontSize={8} fontFamily={mono}>낮음</text>
            <text x={PAD + 82} y={PAD - 22} fill={C.dim} fontSize={8} fontFamily={mono}>높음</text>
            <text x={PAD + 40} y={PAD - 22} textAnchor="middle"
              fill={C.dim} fontSize={8}>손실</text>
          </svg>
        </div>

        {/* ─── Right panel ─── */}
        <div style={{ flex: '1 1 320px', maxWidth: 380 }}>
          {/* MSE 표시 */}
          <div style={{
            textAlign: 'center', padding: '16px', borderRadius: 14,
            background: 'rgba(30,41,59,0.6)',
            border: `1px solid ${C.borderLight}`,
            marginBottom: 16,
          }}>
            <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>
              현재 MSE
            </div>
            <div style={{
              fontFamily: mono, fontSize: 36, fontWeight: 700,
              color: mseLevelColor[mseLevel],
              lineHeight: 1.2,
            }}>
              {currentMSE.toFixed(2)}
            </div>
            <div style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>
              최적 MSE: <span style={{ color: C.emerald, fontFamily: mono }}>{optimalMSE.toFixed(2)}</span>
            </div>
          </div>

          {/* 슬라이더 */}
          <div style={{
            padding: '16px', borderRadius: 14,
            background: 'rgba(30,41,59,0.6)',
            border: `1px solid ${C.borderLight}`,
            marginBottom: 16,
          }}>
            {/* w 슬라이더 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>
                  w (기울기)
                </span>
                <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.orange }}>
                  {w.toFixed(1)}
                </span>
              </div>
              <input
                type="range" min={W_MIN} max={W_MAX} step="0.1"
                value={w}
                onChange={e => setW(Number(e.target.value))}
                style={{ width: '100%', accentColor: C.orange }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.dim, fontSize: 10 }}>{W_MIN}</span>
                <span style={{ color: C.dim, fontSize: 10 }}>{W_MAX}</span>
              </div>
            </div>

            {/* b 슬라이더 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: C.muted, fontSize: 12, fontWeight: 600 }}>
                  b (절편)
                </span>
                <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: C.pink }}>
                  {b.toFixed(1)}
                </span>
              </div>
              <input
                type="range" min={B_MIN} max={B_MAX} step="0.1"
                value={b}
                onChange={e => setB(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#fca5a5' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.dim, fontSize: 10 }}>{B_MIN}</span>
                <span style={{ color: C.dim, fontSize: 10 }}>{B_MAX}</span>
              </div>
            </div>
          </div>

          {/* 기울기 화살표 버튼 */}
          <div style={{
            marginBottom: 16,
          }}>
            <button
              onClick={() => setShowGradient(!showGradient)}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                border: showGradient
                  ? `2px solid ${C.emerald}`
                  : `1px solid ${C.borderLight}`,
                background: showGradient
                  ? 'rgba(16,185,129,0.12)'
                  : 'rgba(30,41,59,0.5)',
                color: showGradient ? C.emerald : C.muted,
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {showGradient ? '🧭 기울기 화살표 숨기기' : '🧭 기울기 화살표 보기 (힌트)'}
            </button>
          </div>

          {/* 기울기 설명 */}
          {showGradient && (
            <div style={{
              padding: '14px', borderRadius: 14,
              background: 'rgba(16,185,129,0.06)',
              border: `1px solid rgba(16,185,129,0.15)`,
              marginBottom: 16,
            }}>
              <div style={{ color: C.emerald, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                기울기(Gradient)가 가리키는 방향
              </div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                <span style={{ color: C.emerald }}>초록 화살표</span> 방향으로 가면 MSE가 가장 빠르게 줄어듭니다.
              </div>
              <div style={{
                marginTop: 8, padding: '8px 10px', borderRadius: 8,
                background: 'rgba(15,23,42,0.5)',
                fontFamily: mono, fontSize: 11, color: C.dim, lineHeight: 1.6,
              }}>
                dMSE/dw = {gradient.dw.toFixed(2)}<br />
                dMSE/db = {gradient.db.toFixed(2)}<br />
                |gradient| = {gradMag.toFixed(2)}
              </div>
              <div style={{
                marginTop: 10, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.15)',
                fontSize: 12, color: C.muted, lineHeight: 1.7,
              }}>
                <strong style={{ color: C.text }}>이 방향을 자동으로 따라가는 법</strong>을 5차시에서 배웁니다
                — 그것이 바로 <strong style={{ color: C.violet }}>경사하강법(Gradient Descent)</strong>입니다.
              </div>
            </div>
          )}

          {/* 현재 위치 정보 */}
          <div style={{
            padding: '12px 16px', borderRadius: 14,
            background: 'rgba(30,41,59,0.5)',
            border: `1px solid ${C.borderLight}`,
          }}>
            <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 8 }}>
              현재 위치
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{
                textAlign: 'center', padding: '8px', borderRadius: 10,
                background: 'rgba(15,23,42,0.5)',
                border: `1px solid ${C.borderLight}`,
              }}>
                <div style={{ color: C.dim, fontSize: 10, marginBottom: 2 }}>w (기울기)</div>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.orange }}>
                  {w.toFixed(1)}
                </div>
              </div>
              <div style={{
                textAlign: 'center', padding: '8px', borderRadius: 10,
                background: 'rgba(15,23,42,0.5)',
                border: `1px solid ${C.borderLight}`,
              }}>
                <div style={{ color: C.dim, fontSize: 10, marginBottom: 2 }}>b (절편)</div>
                <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.pink }}>
                  {b.toFixed(1)}
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 8, textAlign: 'center',
              fontSize: 12, color: C.muted, fontFamily: mono,
            }}>
              y = {w.toFixed(1)}x {b >= 0 ? '+' : ''} {b.toFixed(1)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
