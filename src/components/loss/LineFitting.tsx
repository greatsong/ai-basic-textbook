import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

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

// ─── 3라운드 데이터 ───
interface DataPoint { x: number; y: number }

const ROUND_DATA: DataPoint[][] = [
  // 라운드 1: 거의 직선형 (y ≈ 1.5x + 2, 노이즈 적음)
  [
    { x: 0.5, y: 2.8 }, { x: 1.0, y: 3.6 }, { x: 1.5, y: 4.2 },
    { x: 2.0, y: 5.1 }, { x: 2.5, y: 5.7 }, { x: 3.0, y: 6.5 },
    { x: 3.5, y: 7.2 }, { x: 4.0, y: 8.0 }, { x: 4.5, y: 8.9 },
    { x: 5.0, y: 9.5 },
  ],
  // 라운드 2: 약간 곡선형 (노이즈 더 큼)
  [
    { x: 0.5, y: 1.2 }, { x: 1.0, y: 2.8 }, { x: 1.5, y: 3.0 },
    { x: 2.0, y: 5.5 }, { x: 2.5, y: 4.8 }, { x: 3.0, y: 6.2 },
    { x: 3.5, y: 5.9 }, { x: 4.0, y: 7.8 }, { x: 4.5, y: 7.2 },
    { x: 5.0, y: 9.0 },
  ],
  // 라운드 3: 이상치 포함
  [
    { x: 0.5, y: 2.5 }, { x: 1.0, y: 3.3 }, { x: 1.5, y: 4.0 },
    { x: 2.0, y: 4.9 }, { x: 2.5, y: 5.5 }, { x: 3.0, y: 6.3 },
    { x: 3.5, y: 7.0 }, { x: 4.0, y: 7.8 }, { x: 4.5, y: 8.5 },
    { x: 2.5, y: 12.0 }, // 이상치!
  ],
];

// 최적 MSE 값 (최소제곱법으로 계산한 근사 최적값)
function computeOptimalMSE(data: DataPoint[]): number {
  const n = data.length;
  const sumX = data.reduce((s, p) => s + p.x, 0);
  const sumY = data.reduce((s, p) => s + p.y, 0);
  const sumXY = data.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = data.reduce((s, p) => s + p.x * p.x, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  const wOpt = (sumXY - n * meanX * meanY) / (sumX2 - n * meanX * meanX);
  const bOpt = meanY - wOpt * meanX;
  const mse = data.reduce((s, p) => {
    const err = (wOpt * p.x + bOpt) - p.y;
    return s + err * err;
  }, 0) / n;
  return mse;
}

// ─── SVG dimensions ───
const SVG_W = 420;
const SVG_H = 320;
const PAD = { top: 20, right: 20, bottom: 40, left: 50 };
const plotW = SVG_W - PAD.left - PAD.right;
const plotH = SVG_H - PAD.top - PAD.bottom;

// Data range
const X_MIN = 0;
const X_MAX = 5.5;
const Y_MIN = 0;
const Y_MAX = 14;

function toSvgX(x: number) {
  return PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * plotW;
}
function toSvgY(y: number) {
  return PAD.top + plotH - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * plotH;
}

export default function LineFitting() {
  const [round, setRound] = useState(0);
  const [w, setW] = useState(1.0);
  const [b, setB] = useState(2.0);
  const [bestMSE, setBestMSE] = useState<number[]>([Infinity, Infinity, Infinity]);
  const [timerOn, setTimerOn] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [roundFinished, setRoundFinished] = useState([false, false, false]);
  const [showTimer, setShowTimer] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const data = ROUND_DATA[round];
  const optimalMSE = useMemo(() => computeOptimalMSE(data), [round]);

  // MSE 계산
  const mse = useMemo(() => {
    return data.reduce((sum, p) => {
      const pred = w * p.x + b;
      const err = pred - p.y;
      return sum + err * err;
    }, 0) / data.length;
  }, [w, b, data]);

  // 각 데이터의 오차
  const errors = useMemo(() => {
    return data.map(p => ({
      ...p,
      pred: w * p.x + b,
      error: (w * p.x + b) - p.y,
    }));
  }, [w, b, data]);

  // MSE 레벨 판단
  const mseLevel = useMemo(() => {
    if (mse < optimalMSE * 1.05) return 'excellent';
    if (mse < optimalMSE * 1.5) return 'good';
    if (mse < optimalMSE * 3) return 'ok';
    return 'poor';
  }, [mse, optimalMSE]);

  const mseLevelText = {
    excellent: '거의 최적!',
    good: '꽤 잘 맞추고 있어요',
    ok: '아직 개선 여지가 있어요',
    poor: '빨간 선을 줄여보세요',
  };
  const mseLevelColor = {
    excellent: C.emerald,
    good: C.cyan,
    ok: C.amber,
    poor: C.rose,
  };

  // 최고 기록 업데이트
  useEffect(() => {
    setBestMSE(prev => {
      const next = [...prev];
      if (mse < next[round]) next[round] = mse;
      return next;
    });
  }, [mse, round]);

  // 타이머
  useEffect(() => {
    if (timerOn && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimerOn(false);
            setRoundFinished(prev => {
              const next = [...prev];
              next[round] = true;
              return next;
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerOn, timeLeft, round]);

  const startRound = useCallback(() => {
    setTimeLeft(30);
    setTimerOn(true);
  }, []);

  const switchRound = useCallback((r: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRound(r);
    setW(1.0);
    setB(2.0);
    setTimerOn(false);
    setTimeLeft(30);
  }, []);

  // 직선의 SVG 좌표
  const lineY1 = w * X_MIN + b;
  const lineY2 = w * X_MAX + b;

  // 이상치 체크 (라운드 3)
  const isOutlier = (p: DataPoint) =>
    round === 2 && p.x === 2.5 && p.y === 12.0;

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
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 14 }}>📉</span>
          <span style={{ color: '#fca5a5', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>직선 피팅 대결</span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          슬라이더를 움직여 빨간 선이 가장 짧아지도록 만들어보세요
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          w(기울기)와 b(절편)를 조절하여 데이터에 가장 잘 맞는 직선을 찾으세요
        </p>
      </div>

      {/* ─── Round Tabs ─── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
        {['라운드 1: 직선형', '라운드 2: 흩어짐', '라운드 3: 이상치'].map((label, i) => {
          const active = round === i;
          return (
            <button
              key={i}
              onClick={() => switchRound(i)}
              disabled={timerOn}
              style={{
                padding: '9px 20px', borderRadius: 12,
                border: active ? `2px solid ${i === 2 ? C.rose : C.violet}` : `1px solid ${C.borderLight}`,
                background: active
                  ? (i === 2 ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.12)')
                  : 'rgba(30,41,59,0.4)',
                color: active ? C.text : C.muted,
                fontSize: 13, fontWeight: 700,
                cursor: timerOn ? 'not-allowed' : 'pointer',
                opacity: timerOn && !active ? 0.4 : 1,
                transition: 'all 0.2s',
              }}
            >
              {label}
              {roundFinished[i] && <span style={{ marginLeft: 6, color: C.emerald }}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* ─── Timer & Start ─── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showTimer}
            onChange={e => setShowTimer(e.target.checked)}
            style={{ accentColor: C.violet }}
          />
          <span style={{ color: C.muted, fontSize: 12 }}>30초 타이머</span>
        </label>
        {showTimer && !timerOn && !roundFinished[round] && (
          <button
            onClick={startRound}
            style={{
              padding: '8px 24px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(99,102,241,0.2)',
            }}
          >
            ▶ 타이머 시작
          </button>
        )}
        {showTimer && timerOn && (
          <div style={{
            padding: '6px 20px', borderRadius: 12,
            background: timeLeft <= 10 ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.1)',
            border: `1px solid ${timeLeft <= 10 ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.2)'}`,
          }}>
            <span style={{
              fontFamily: mono, fontSize: 20, fontWeight: 700,
              color: timeLeft <= 10 ? C.rose : C.text,
            }}>
              {timeLeft}
            </span>
            <span style={{ color: C.muted, fontSize: 12, marginLeft: 4 }}>초</span>
          </div>
        )}
        {showTimer && roundFinished[round] && (
          <span style={{ color: C.emerald, fontSize: 13, fontWeight: 600 }}>
            라운드 {round + 1} 완료!
          </span>
        )}
      </div>

      {/* ─── Main content: Chart + Controls ─── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* ─── SVG Chart ─── */}
        <div style={{
          background: C.card,
          borderRadius: 16,
          border: `1px solid ${C.borderLight}`,
          padding: 12,
          flex: '1 1 440px',
          maxWidth: 460,
        }}>
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          >
            {/* 배경 */}
            <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
              fill="rgba(15,23,42,0.5)" rx={4} />

            {/* 격자선 */}
            {[0, 1, 2, 3, 4, 5].map(v => (
              <g key={`gx-${v}`}>
                <line
                  x1={toSvgX(v)} y1={PAD.top} x2={toSvgX(v)} y2={PAD.top + plotH}
                  stroke="rgba(71,85,105,0.15)" strokeWidth={1}
                />
                <text x={toSvgX(v)} y={SVG_H - 12} textAnchor="middle"
                  fill={C.dim} fontSize={11} fontFamily={mono}>{v}</text>
              </g>
            ))}
            {[0, 2, 4, 6, 8, 10, 12, 14].map(v => (
              <g key={`gy-${v}`}>
                <line
                  x1={PAD.left} y1={toSvgY(v)} x2={PAD.left + plotW} y2={toSvgY(v)}
                  stroke="rgba(71,85,105,0.15)" strokeWidth={1}
                />
                <text x={PAD.left - 8} y={toSvgY(v) + 4} textAnchor="end"
                  fill={C.dim} fontSize={11} fontFamily={mono}>{v}</text>
              </g>
            ))}

            {/* 축 라벨 */}
            <text x={SVG_W / 2} y={SVG_H - 0} textAnchor="middle"
              fill={C.muted} fontSize={12}>x</text>
            <text x={12} y={SVG_H / 2} textAnchor="middle"
              fill={C.muted} fontSize={12}
              transform={`rotate(-90, 12, ${SVG_H / 2})`}>y</text>

            {/* 오차 세로선 (빨간) */}
            {errors.map((e, i) => (
              <line
                key={`err-${i}`}
                x1={toSvgX(e.x)} y1={toSvgY(e.y)}
                x2={toSvgX(e.x)} y2={toSvgY(e.pred)}
                stroke={C.rose}
                strokeWidth={2}
                strokeDasharray="4,3"
                opacity={0.7}
              />
            ))}

            {/* 직선 y = wx + b */}
            <line
              x1={toSvgX(X_MIN)} y1={toSvgY(lineY1)}
              x2={toSvgX(X_MAX)} y2={toSvgY(lineY2)}
              stroke={C.cyan}
              strokeWidth={2.5}
              strokeLinecap="round"
            />

            {/* 데이터 포인트 */}
            {data.map((p, i) => {
              const outlier = isOutlier(p);
              return (
                <g key={`pt-${i}`}>
                  {outlier && (
                    <circle
                      cx={toSvgX(p.x)} cy={toSvgY(p.y)} r={12}
                      fill="none" stroke={C.amber} strokeWidth={2}
                      strokeDasharray="3,3" opacity={0.6}
                    />
                  )}
                  <circle
                    cx={toSvgX(p.x)} cy={toSvgY(p.y)} r={6}
                    fill={outlier ? C.amber : C.violet}
                    stroke={outlier ? C.amber : 'rgba(139,92,246,0.5)'}
                    strokeWidth={2}
                  />
                </g>
              );
            })}

            {/* 직선 수식 라벨 */}
            <text x={PAD.left + 8} y={PAD.top + 18}
              fill={C.cyan} fontSize={12} fontFamily={mono} fontWeight={700}>
              y = {w.toFixed(1)}x {b >= 0 ? '+' : ''} {b.toFixed(1)}
            </text>
          </svg>
        </div>

        {/* ─── Right panel: Sliders + Stats ─── */}
        <div style={{ flex: '1 1 320px', maxWidth: 380 }}>
          {/* MSE 표시 */}
          <div style={{
            textAlign: 'center', padding: '16px', borderRadius: 14,
            background: 'rgba(30,41,59,0.6)',
            border: `1px solid ${C.borderLight}`,
            marginBottom: 16,
          }}>
            <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>
              MSE (평균제곱오차)
            </div>
            <div style={{
              fontFamily: mono, fontSize: 36, fontWeight: 700,
              color: mseLevelColor[mseLevel],
              lineHeight: 1.2,
            }}>
              {mse.toFixed(2)}
            </div>
            <div style={{ color: mseLevelColor[mseLevel], fontSize: 12, marginTop: 4 }}>
              {mseLevelText[mseLevel]}
            </div>
            <div style={{ color: C.dim, fontSize: 11, marginTop: 6 }}>
              "평균적으로 {mse.toFixed(2)}만큼 틀렸다"
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
                type="range" min="-2" max="5" step="0.1"
                value={w}
                onChange={e => setW(Number(e.target.value))}
                style={{ width: '100%', accentColor: C.orange }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.dim, fontSize: 10 }}>-2.0</span>
                <span style={{ color: C.dim, fontSize: 10 }}>5.0</span>
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
                type="range" min="-5" max="10" step="0.1"
                value={b}
                onChange={e => setB(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#fca5a5' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: C.dim, fontSize: 10 }}>-5.0</span>
                <span style={{ color: C.dim, fontSize: 10 }}>10.0</span>
              </div>
            </div>
          </div>

          {/* 최저 기록 */}
          <div style={{
            padding: '12px 16px', borderRadius: 14,
            background: 'rgba(16,185,129,0.06)',
            border: `1px solid rgba(16,185,129,0.15)`,
            marginBottom: 16,
          }}>
            <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 8 }}>
              최저 MSE 기록
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {['R1', 'R2', 'R3'].map((label, i) => (
                <div key={label} style={{
                  textAlign: 'center', padding: '6px 4px', borderRadius: 10,
                  background: round === i ? 'rgba(16,185,129,0.1)' : 'rgba(15,23,42,0.4)',
                  border: `1px solid ${round === i ? 'rgba(16,185,129,0.2)' : C.borderLight}`,
                }}>
                  <div style={{ color: C.dim, fontSize: 10, marginBottom: 2 }}>{label}</div>
                  <div style={{
                    fontFamily: mono, fontSize: 14, fontWeight: 700,
                    color: bestMSE[i] < Infinity ? C.emerald : C.dim,
                  }}>
                    {bestMSE[i] < Infinity ? bestMSE[i].toFixed(2) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 오차 분해 테이블 */}
          <div style={{
            padding: '12px', borderRadius: 14,
            background: 'rgba(30,41,59,0.5)',
            border: `1px solid ${C.borderLight}`,
            maxHeight: 200,
            overflowY: 'auto',
          }}>
            <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>
              각 데이터별 오차
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: mono }}>
              <thead>
                <tr style={{ color: C.dim }}>
                  <th style={{ padding: '3px 4px', textAlign: 'center' }}>x</th>
                  <th style={{ padding: '3px 4px', textAlign: 'center' }}>실제 y</th>
                  <th style={{ padding: '3px 4px', textAlign: 'center' }}>예측</th>
                  <th style={{ padding: '3px 4px', textAlign: 'center' }}>오차</th>
                  <th style={{ padding: '3px 4px', textAlign: 'center' }}>오차²</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => {
                  const errSq = e.error * e.error;
                  const outlier = isOutlier(e);
                  return (
                    <tr key={i} style={{
                      borderTop: `1px solid ${C.borderLight}`,
                      background: outlier ? 'rgba(245,158,11,0.08)' : undefined,
                    }}>
                      <td style={{ padding: '4px', textAlign: 'center', color: C.muted }}>{e.x.toFixed(1)}</td>
                      <td style={{ padding: '4px', textAlign: 'center', color: C.text }}>{e.y.toFixed(1)}</td>
                      <td style={{ padding: '4px', textAlign: 'center', color: C.cyan }}>{e.pred.toFixed(1)}</td>
                      <td style={{
                        padding: '4px', textAlign: 'center',
                        color: Math.abs(e.error) > 2 ? C.rose : C.muted,
                        fontWeight: Math.abs(e.error) > 2 ? 700 : 400,
                      }}>
                        {e.error >= 0 ? '+' : ''}{e.error.toFixed(1)}
                      </td>
                      <td style={{
                        padding: '4px', textAlign: 'center',
                        color: errSq > 4 ? C.rose : C.muted,
                        fontWeight: errSq > 4 ? 700 : 400,
                      }}>
                        {errSq.toFixed(1)}
                        {outlier && <span style={{ color: C.amber, marginLeft: 2 }}>!</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 라운드 3 이상치 안내 */}
          {round === 2 && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              fontSize: 12, color: C.amber, lineHeight: 1.6,
            }}>
              <strong>이상치 발견!</strong> 노란 원으로 표시된 점은 나머지와 동떨어져 있습니다.
              오차를 제곱하기 때문에, 이 점 하나가 MSE에 큰 영향을 미칩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
