import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ─── Color constants (6차시 다크 테마) ───
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

// ─── 공유 네트워크 매개변수 ───
const INIT = {
  x1: 1.0, x2: 0.5,
  w1: 0.3, w2: 0.7, b1: 0.1,
  w3: 0.5, b2: 0.2,
  target: 1.0,
};

const LR = 0.5;

// ─── Sigmoid ───
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

interface Weights {
  w1: number; w2: number; b1: number;
  w3: number; b2: number;
}

interface HistoryRow {
  epoch: number;
  w1: number; w2: number; b1: number;
  w3: number; b2: number;
  loss: number;
  yHat: number;
}

// ─── 순전파 ───
function forward(w: Weights) {
  const z1 = w.w1 * INIT.x1 + w.w2 * INIT.x2 + w.b1;
  const a1 = sigmoid(z1);
  const z2 = w.w3 * a1 + w.b2;
  const yHat = sigmoid(z2);
  return { z1, a1, z2, yHat };
}

// ─── 1회 학습 ───
function trainOnce(w: Weights): { newW: Weights; loss: number; yHat: number } {
  const { a1, yHat } = forward(w);
  const loss = (INIT.target - yHat) ** 2;

  const dL_dyHat = -2 * (INIT.target - yHat);
  const dyHat_dz2 = yHat * (1 - yHat);
  const dL_dz2 = dL_dyHat * dyHat_dz2;

  const dL_dw3 = dL_dz2 * a1;
  const dL_db2 = dL_dz2;

  const dL_da1 = dL_dz2 * w.w3;
  const da1_dz1 = a1 * (1 - a1);
  const dL_dz1 = dL_da1 * da1_dz1;

  const dL_dw1 = dL_dz1 * INIT.x1;
  const dL_dw2 = dL_dz1 * INIT.x2;
  const dL_db1 = dL_dz1;

  return {
    newW: {
      w1: w.w1 - LR * dL_dw1,
      w2: w.w2 - LR * dL_dw2,
      b1: w.b1 - LR * dL_db1,
      w3: w.w3 - LR * dL_dw3,
      b2: w.b2 - LR * dL_db2,
    },
    loss,
    yHat,
  };
}

// ─── SVG 손실 그래프 ───
const GRAPH_W = 500;
const GRAPH_H = 200;
const GP = { top: 20, right: 20, bottom: 35, left: 55 };
const gpW = GRAPH_W - GP.left - GP.right;
const gpH = GRAPH_H - GP.top - GP.bottom;

// ─── 네트워크 SVG ───
const NET_W = 420;
const NET_H = 200;

// ─── 수렴 파티클 ───
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

export default function BackpropTrainer() {
  const [weights, setWeights] = useState<Weights>({
    w1: INIT.w1, w2: INIT.w2, b1: INIT.b1, w3: INIT.w3, b2: INIT.b2,
  });
  const [history, setHistory] = useState<HistoryRow[]>([{
    epoch: 0,
    w1: INIT.w1, w2: INIT.w2, b1: INIT.b1, w3: INIT.w3, b2: INIT.b2,
    loss: (INIT.target - sigmoid(INIT.w3 * sigmoid(INIT.w1 * INIT.x1 + INIT.w2 * INIT.x2 + INIT.b1) + INIT.b2)) ** 2,
    yHat: sigmoid(INIT.w3 * sigmoid(INIT.w1 * INIT.x1 + INIT.w2 * INIT.x2 + INIT.b1) + INIT.b2),
  }]);
  const [epoch, setEpoch] = useState(0);
  const [converged, setConverged] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 수렴 판정
  const currentLoss = history[history.length - 1]?.loss ?? 0;
  const currentYHat = history[history.length - 1]?.yHat ?? 0;

  const doTrain = useCallback((n: number) => {
    if (converged) return;

    setWeights(prevW => {
      let w = { ...prevW };
      return w; // 아래에서 직접 계산
    });

    // 동기적으로 현재 weights에서 계산
    let w = { ...weights };
    const newRows: HistoryRow[] = [];
    let currentEpoch = epoch;
    let didConverge = false;

    for (let i = 0; i < n; i++) {
      const { newW, loss, yHat } = trainOnce(w);
      w = newW;
      currentEpoch += 1;
      newRows.push({
        epoch: currentEpoch,
        w1: w.w1, w2: w.w2, b1: w.b1, w3: w.w3, b2: w.b2,
        loss, yHat,
      });
      if (loss < 0.001) {
        didConverge = true;
        break;
      }
    }

    setWeights(w);
    setHistory(prev => [...prev, ...newRows]);
    setEpoch(currentEpoch);
    if (didConverge) setConverged(true);
  }, [weights, epoch, converged]);

  // 수렴 시 파티클 발생
  useEffect(() => {
    if (!converged) return;
    const colors = [C.emerald, C.cyan, C.violet, C.amber, C.blue, '#f472b6'];
    const newParticles: Particle[] = [];
    for (let i = 0; i < 30; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x: 50 + Math.random() * 200,
        y: 10 + Math.random() * 30,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 60 + Math.random() * 40,
      });
    }
    setParticles(newParticles);
  }, [converged]);

  // 파티클 애니메이션
  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.1,
          life: p.life - 1,
        }))
        .filter(p => p.life > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, [particles.length > 0]);

  const handleReset = useCallback(() => {
    const initW: Weights = { w1: INIT.w1, w2: INIT.w2, b1: INIT.b1, w3: INIT.w3, b2: INIT.b2 };
    const { yHat } = forward(initW);
    const loss = (INIT.target - yHat) ** 2;
    setWeights(initW);
    setHistory([{ epoch: 0, ...initW, loss, yHat }]);
    setEpoch(0);
    setConverged(false);
    setParticles([]);
  }, []);

  // 그래프용 데이터
  const losses = useMemo(() => history.map(h => h.loss), [history]);
  const maxLoss = useMemo(() => Math.max(...losses, 0.01) * 1.1, [losses]);
  const maxEpoch = Math.max(epoch, 10);

  // 표시할 히스토리 (최근 10행)
  const visibleHistory = history.slice(-10);

  // 손실 그래프 패스
  const lossPath = useMemo(() => {
    if (losses.length < 2) return '';
    return losses.map((l, i) => {
      const x = GP.left + (i / maxEpoch) * gpW;
      const y = GP.top + gpH - (Math.min(l, maxLoss) / maxLoss) * gpH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }, [losses, maxLoss, maxEpoch]);

  return (
    <div ref={containerRef} style={{
      background: `linear-gradient(145deg, ${C.bg}, rgba(10,15,30,0.98))`,
      borderRadius: 20,
      padding: '24px 20px',
      border: `1px solid ${C.border}`,
      maxWidth: 900,
      margin: '2rem auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 수렴 파티클 */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${(p.x / 300) * 100}%`,
          top: p.y,
          width: 6, height: 6,
          borderRadius: '50%',
          background: p.color,
          opacity: p.life / 100,
          pointerEvents: 'none',
          transition: 'none',
        }} />
      ))}

      {/* ─── Header ─── */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 14 }}>&#9881;</span>
          <span style={{ color: '#6ee7b7', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>반복 학습기</span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          신경망을 반복 학습시켜 손실을 0에 가깝게 만드세요
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          학습률 η = {LR} | 목표: Loss {'<'} 0.001
        </p>
      </div>

      {/* ─── Network Diagram ─── */}
      <div style={{
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.borderLight}`,
        padding: 12,
        marginBottom: 16,
      }}>
        <svg viewBox={`0 0 ${NET_W} ${NET_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <style>{`
              @keyframes bt-pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
            `}</style>
          </defs>

          {/* 간선 + 가중치 값 */}
          {[
            { x1: 60, y1: 60, x2: 210, y2: 100, name: 'w₁', val: weights.w1, color: C.orange },
            { x1: 60, y1: 140, x2: 210, y2: 100, name: 'w₂', val: weights.w2, color: C.pink },
            { x1: 210, y1: 100, x2: 360, y2: 100, name: 'w₃', val: weights.w3, color: C.cyan },
          ].map((e, i) => (
            <g key={i}>
              <line x1={e.x1 + 25} y1={e.y1} x2={e.x2 - 25} y2={e.y2}
                stroke={e.color} strokeWidth={2.5} opacity={0.6} />
              <text x={(e.x1 + e.x2) / 2 + (i < 2 ? -15 : 0)}
                y={(e.y1 + e.y2) / 2 + (i === 0 ? -12 : i === 1 ? 16 : -14)}
                textAnchor="middle" fill={e.color} fontSize={10} fontFamily={mono} fontWeight={700}>
                {e.name}={e.val.toFixed(3)}
              </text>
            </g>
          ))}

          {/* 편향 */}
          <text x={210} y={55} textAnchor="middle" fill={C.violet} fontSize={9} fontFamily={mono}>
            b₁={weights.b1.toFixed(3)}
          </text>
          <text x={360} y={55} textAnchor="middle" fill={C.violet} fontSize={9} fontFamily={mono}>
            b₂={weights.b2.toFixed(3)}
          </text>

          {/* 입력 노드 */}
          {[
            { cx: 60, cy: 60, label: 'x₁', sub: `${INIT.x1}` },
            { cx: 60, cy: 140, label: 'x₂', sub: `${INIT.x2}` },
          ].map((n, i) => (
            <g key={`in-${i}`}>
              <circle cx={n.cx} cy={n.cy} r={22} fill="rgba(59,130,246,0.12)"
                stroke={C.blue} strokeWidth={2} />
              <text x={n.cx} y={n.cy - 4} textAnchor="middle" fill={C.blue}
                fontSize={10} fontWeight={700}>{n.label}</text>
              <text x={n.cx} y={n.cy + 10} textAnchor="middle" fill={C.text}
                fontSize={11} fontFamily={mono} fontWeight={700}>{n.sub}</text>
            </g>
          ))}

          {/* 은닉 노드 */}
          <g>
            <circle cx={210} cy={100} r={24} fill="rgba(139,92,246,0.15)"
              stroke={C.violet} strokeWidth={2.5} />
            <text x={210} y={104} textAnchor="middle" fill={C.violet}
              fontSize={11} fontWeight={700}>h₁</text>
          </g>

          {/* 출력 노드 */}
          <g>
            <circle cx={360} cy={100} r={24}
              fill={converged ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.12)'}
              stroke={converged ? C.emerald : C.amber} strokeWidth={2.5}
              style={converged ? { animation: 'bt-pulse 1.2s ease infinite' } : undefined}
            />
            <text x={360} y={96} textAnchor="middle"
              fill={converged ? C.emerald : C.amber}
              fontSize={10} fontWeight={700}>ŷ</text>
            <text x={360} y={110} textAnchor="middle" fill={C.text}
              fontSize={10} fontFamily={mono} fontWeight={700}>
              {currentYHat.toFixed(3)}
            </text>
          </g>

          {/* 예측 vs 정답 */}
          <text x={360} y={150} textAnchor="middle" fill={C.muted} fontSize={10} fontFamily={mono}>
            예측 {currentYHat.toFixed(3)} / 정답 {INIT.target}
          </text>

          {/* 손실 */}
          <text x={360} y={168} textAnchor="middle"
            fill={converged ? C.emerald : C.rose}
            fontSize={11} fontFamily={mono} fontWeight={700}>
            Loss = {currentLoss.toFixed(6)}
          </text>
        </svg>
      </div>

      {/* ─── Controls ─── */}
      <div style={{
        display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16,
      }}>
        <button
          onClick={() => doTrain(1)}
          disabled={converged}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: converged ? C.dim : C.blue,
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: converged ? 'not-allowed' : 'pointer',
            opacity: converged ? 0.5 : 1,
          }}
        >
          학습 1회
        </button>
        <button
          onClick={() => doTrain(10)}
          disabled={converged}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: converged ? C.dim : C.violet,
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: converged ? 'not-allowed' : 'pointer',
            opacity: converged ? 0.5 : 1,
          }}
        >
          학습 10회
        </button>
        <button
          onClick={() => doTrain(100)}
          disabled={converged}
          style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: converged ? C.dim : C.emerald,
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: converged ? 'not-allowed' : 'pointer',
            opacity: converged ? 0.5 : 1,
          }}
        >
          학습 100회
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: '10px 20px', borderRadius: 10,
            border: `1px solid ${C.borderLight}`,
            background: 'rgba(30,41,59,0.5)',
            color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          리셋
        </button>
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(30,41,59,0.6)',
          border: `1px solid ${C.borderLight}`,
          color: C.text, fontSize: 13, fontFamily: mono, fontWeight: 600,
        }}>
          현재 {epoch}회 학습 완료
        </div>
      </div>

      {/* ─── Convergence Message ─── */}
      {converged && (
        <div style={{
          textAlign: 'center', padding: '16px 20px', borderRadius: 14,
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.emerald, marginBottom: 6 }}>
            학습이 수렴했습니다!
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {epoch}회 학습 후 Loss가 0.001 미만으로 줄었습니다.
            예측값 <span style={{ color: C.emerald, fontFamily: mono, fontWeight: 700 }}>{currentYHat.toFixed(4)}</span>이
            정답 <span style={{ color: C.amber, fontFamily: mono, fontWeight: 700 }}>{INIT.target}</span>에
            매우 가까워졌습니다.
          </div>
        </div>
      )}

      {/* ─── Loss Graph + Weight Table ─── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Loss graph */}
        <div style={{
          flex: '1 1 380px',
          background: C.card,
          borderRadius: 14,
          border: `1px solid ${C.borderLight}`,
          padding: 14,
        }}>
          <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 8 }}>
            손실 변화 그래프
          </div>
          <svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* 격자 */}
            {[0, 0.25, 0.5, 0.75, 1].map(t => {
              const y = GP.top + gpH * (1 - t);
              return (
                <g key={t}>
                  <line x1={GP.left} y1={y} x2={GP.left + gpW} y2={y}
                    stroke={C.borderLight} strokeWidth={0.5} />
                  <text x={GP.left - 6} y={y + 3} textAnchor="end"
                    fill={C.dim} fontSize={8} fontFamily={mono}>
                    {(maxLoss * t).toFixed(3)}
                  </text>
                </g>
              );
            })}

            {/* X축 */}
            {Array.from({ length: 6 }, (_, i) => Math.round((maxEpoch / 5) * i)).map(ep => {
              const x = GP.left + (ep / maxEpoch) * gpW;
              return (
                <text key={ep} x={x} y={GRAPH_H - 8} textAnchor="middle"
                  fill={C.dim} fontSize={8} fontFamily={mono}>{ep}</text>
              );
            })}
            <text x={GP.left + gpW / 2} y={GRAPH_H} textAnchor="middle"
              fill={C.muted} fontSize={9}>Epoch</text>
            <text x={10} y={GP.top + gpH / 2} textAnchor="middle"
              fill={C.muted} fontSize={9}
              transform={`rotate(-90, 10, ${GP.top + gpH / 2})`}>Loss</text>

            {/* 손실 곡선 */}
            {lossPath && (
              <path d={lossPath} fill="none" stroke={C.blue} strokeWidth={2}
                strokeLinecap="round" />
            )}

            {/* 수렴 기준선 */}
            {(() => {
              const y = GP.top + gpH - (0.001 / maxLoss) * gpH;
              return y > GP.top && y < GP.top + gpH ? (
                <g>
                  <line x1={GP.left} y1={y} x2={GP.left + gpW} y2={y}
                    stroke={C.emerald} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
                  <text x={GP.left + gpW + 4} y={y + 3} fill={C.emerald}
                    fontSize={8} fontFamily={mono}>0.001</text>
                </g>
              ) : null;
            })()}

            {/* 현재 점 */}
            {losses.length > 0 && (
              <circle
                cx={GP.left + ((losses.length - 1) / maxEpoch) * gpW}
                cy={GP.top + gpH - (Math.min(losses[losses.length - 1], maxLoss) / maxLoss) * gpH}
                r={4} fill={C.blue} stroke="#fff" strokeWidth={1.5}
              />
            )}
          </svg>
        </div>

        {/* Weight table */}
        <div style={{
          flex: '1 1 340px',
          background: C.card,
          borderRadius: 14,
          border: `1px solid ${C.borderLight}`,
          padding: 14,
          overflowX: 'auto',
        }}>
          <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 8 }}>
            가중치 변화 (최근 {visibleHistory.length}행)
          </div>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontFamily: mono, fontSize: 10,
          }}>
            <thead>
              <tr>
                {['Epoch', 'w₁', 'w₂', 'b₁', 'w₃', 'b₂', 'Loss'].map(h => (
                  <th key={h} style={{
                    padding: '5px 4px', textAlign: 'center',
                    borderBottom: `1px solid ${C.borderLight}`,
                    color: C.dim, fontSize: 9, fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleHistory.map((row, i) => {
                const isLast = i === visibleHistory.length - 1;
                return (
                  <tr key={row.epoch} style={{
                    background: isLast ? 'rgba(59,130,246,0.08)' : 'transparent',
                  }}>
                    <td style={{ padding: '4px', textAlign: 'center', color: C.muted }}>{row.epoch}</td>
                    <td style={{ padding: '4px', textAlign: 'center', color: C.orange }}>{row.w1.toFixed(3)}</td>
                    <td style={{ padding: '4px', textAlign: 'center', color: C.pink }}>{row.w2.toFixed(3)}</td>
                    <td style={{ padding: '4px', textAlign: 'center', color: C.violet }}>{row.b1.toFixed(3)}</td>
                    <td style={{ padding: '4px', textAlign: 'center', color: C.cyan }}>{row.w3.toFixed(3)}</td>
                    <td style={{ padding: '4px', textAlign: 'center', color: C.violet }}>{row.b2.toFixed(3)}</td>
                    <td style={{
                      padding: '4px', textAlign: 'center',
                      color: row.loss < 0.001 ? C.emerald : row.loss < 0.01 ? C.amber : C.rose,
                      fontWeight: isLast ? 700 : 400,
                    }}>
                      {row.loss.toFixed(5)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Educational footer ─── */}
      <div style={{
        marginTop: 16, padding: '12px 16px', borderRadius: 12,
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.15)',
        fontSize: 13, color: C.muted, lineHeight: 1.7, textAlign: 'center',
      }}>
        매 학습마다 <strong style={{ color: C.blue }}>순전파</strong>로 예측하고,
        <strong style={{ color: C.rose }}> 역전파</strong>로 기울기를 계산한 뒤,
        <strong style={{ color: C.emerald }}> 경사하강법</strong>으로 가중치를 업데이트합니다.
        <br />이 과정을 수백~수천 번 반복하면 신경망이 점점 정확해집니다.
      </div>
    </div>
  );
}
