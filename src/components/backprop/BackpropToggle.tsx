import { useState, useCallback, useMemo } from 'react';

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

// ─── 순전파 ───
function forward(w: Weights): { z1: number; a1: number; z2: number; yHat: number } {
  const z1 = w.w1 * INIT.x1 + w.w2 * INIT.x2 + w.b1;
  const a1 = sigmoid(z1);
  const z2 = w.w3 * a1 + w.b2;
  const yHat = sigmoid(z2);
  return { z1, a1, z2, yHat };
}

// ─── 1회 학습 (역전파 ON/OFF) ───
function trainOnce(w: Weights, backpropOn: boolean): { newW: Weights; loss: number } {
  const { a1, yHat } = forward(w);
  const loss = (INIT.target - yHat) ** 2;

  // 출력층 기울기
  const dL_dyHat = -2 * (INIT.target - yHat);
  const dyHat_dz2 = yHat * (1 - yHat);
  const dL_dz2 = dL_dyHat * dyHat_dz2;
  const dL_dw3 = dL_dz2 * a1;
  const dL_db2 = dL_dz2;

  // 은닉층 기울기 (역전파 ON일 때만)
  let dL_dw1 = 0, dL_dw2 = 0, dL_db1 = 0;
  if (backpropOn) {
    const dL_da1 = dL_dz2 * w.w3;
    const da1_dz1 = a1 * (1 - a1);
    const dL_dz1 = dL_da1 * da1_dz1;
    dL_dw1 = dL_dz1 * INIT.x1;
    dL_dw2 = dL_dz1 * INIT.x2;
    dL_db1 = dL_dz1;
  }

  return {
    newW: {
      w1: w.w1 - LR * dL_dw1,
      w2: w.w2 - LR * dL_dw2,
      b1: w.b1 - LR * dL_db1,
      w3: w.w3 - LR * dL_dw3,
      b2: w.b2 - LR * dL_db2,
    },
    loss,
  };
}

// ─── N회 학습 후 손실 기록 ───
function trainN(initW: Weights, n: number, backpropOn: boolean): number[] {
  const losses: number[] = [];
  let w = { ...initW };
  for (let i = 0; i < n; i++) {
    const { newW, loss } = trainOnce(w, backpropOn);
    losses.push(loss);
    w = newW;
  }
  return losses;
}

// ─── SVG 손실 그래프 ───
const GRAPH_W = 400;
const GRAPH_H = 200;
const GRAPH_PAD = { top: 20, right: 20, bottom: 35, left: 55 };
const plotW = GRAPH_W - GRAPH_PAD.left - GRAPH_PAD.right;
const plotH = GRAPH_H - GRAPH_PAD.top - GRAPH_PAD.bottom;

function buildPath(losses: number[], maxLoss: number): string {
  if (losses.length === 0) return '';
  return losses.map((l, i) => {
    const x = GRAPH_PAD.left + (i / (losses.length - 1)) * plotW;
    const y = GRAPH_PAD.top + plotH - (Math.min(l, maxLoss) / maxLoss) * plotH;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');
}

// ─── 네트워크 SVG ───
const NET_W = 340;
const NET_H = 160;

export default function BackpropToggle() {
  const [backpropOn, setBackpropOn] = useState(true);
  const [lossesOn, setLossesOn] = useState<number[]>([]);
  const [lossesOff, setLossesOff] = useState<number[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const handleTrain10 = useCallback(() => {
    const initW: Weights = { w1: INIT.w1, w2: INIT.w2, b1: INIT.b1, w3: INIT.w3, b2: INIT.b2 };
    const on = trainN(initW, 50, true);
    const off = trainN(initW, 50, false);
    setLossesOn(on);
    setLossesOff(off);
    setHasRun(true);
  }, []);

  const handleReset = useCallback(() => {
    setLossesOn([]);
    setLossesOff([]);
    setHasRun(false);
  }, []);

  const maxLoss = useMemo(() => {
    if (!hasRun) return 0.2;
    const all = [...lossesOn, ...lossesOff];
    return Math.max(...all, 0.01) * 1.1;
  }, [lossesOn, lossesOff, hasRun]);

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
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 14 }}>&#8644;</span>
          <span style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>역전파 ON/OFF 비교</span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          역전파가 없으면 은닉층은 학습하지 못합니다
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          역전파를 끄면 출력층 가중치만 업데이트됩니다
        </p>
      </div>

      {/* ─── Toggle + Networks side by side ─── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
        {/* ON side */}
        <div style={{
          flex: '1 1 300px', maxWidth: 400,
          background: backpropOn ? 'rgba(16,185,129,0.06)' : C.card,
          borderRadius: 16,
          border: `1px solid ${backpropOn ? 'rgba(16,185,129,0.25)' : C.borderLight}`,
          padding: 14,
          transition: 'all 0.3s',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <span style={{
              display: 'inline-block', padding: '4px 16px', borderRadius: 99,
              background: 'rgba(16,185,129,0.15)', color: C.emerald,
              fontSize: 13, fontWeight: 700,
            }}>
              역전파 ON
            </span>
          </div>
          <svg viewBox={`0 0 ${NET_W} ${NET_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* 간선 — 모두 활성 */}
            {[
              { x1: 50, y1: 50, x2: 170, y2: 80, label: 'w₁', color: C.orange },
              { x1: 50, y1: 110, x2: 170, y2: 80, label: 'w₂', color: C.pink },
              { x1: 170, y1: 80, x2: 290, y2: 80, label: 'w₃', color: C.cyan },
            ].map((e, i) => (
              <g key={i}>
                <line x1={e.x1 + 22} y1={e.y1} x2={e.x2 - 22} y2={e.y2}
                  stroke={e.color} strokeWidth={2.5} opacity={0.7} />
                <text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 8}
                  textAnchor="middle" fill={e.color} fontSize={10} fontFamily={mono} fontWeight={700}>
                  {e.label}
                </text>
              </g>
            ))}
            {/* 노드 */}
            {[
              { cx: 50, cy: 50, label: 'x₁', color: C.blue },
              { cx: 50, cy: 110, label: 'x₂', color: C.blue },
              { cx: 170, cy: 80, label: 'h₁', color: C.violet },
              { cx: 290, cy: 80, label: 'ŷ', color: C.amber },
            ].map((n, i) => (
              <g key={i}>
                <circle cx={n.cx} cy={n.cy} r={20}
                  fill={`${n.color}18`} stroke={n.color} strokeWidth={2} />
                <text x={n.cx} y={n.cy + 4} textAnchor="middle"
                  fill={n.color} fontSize={11} fontWeight={700}>{n.label}</text>
              </g>
            ))}
            <text x={NET_W / 2} y={NET_H - 5} textAnchor="middle"
              fill={C.emerald} fontSize={11} fontWeight={600}>
              모든 가중치 업데이트
            </text>
          </svg>
        </div>

        {/* OFF side */}
        <div style={{
          flex: '1 1 300px', maxWidth: 400,
          background: !backpropOn ? 'rgba(239,68,68,0.06)' : C.card,
          borderRadius: 16,
          border: `1px solid ${!backpropOn ? 'rgba(239,68,68,0.25)' : C.borderLight}`,
          padding: 14,
          transition: 'all 0.3s',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <span style={{
              display: 'inline-block', padding: '4px 16px', borderRadius: 99,
              background: 'rgba(239,68,68,0.15)', color: C.rose,
              fontSize: 13, fontWeight: 700,
            }}>
              역전파 OFF
            </span>
          </div>
          <svg viewBox={`0 0 ${NET_W} ${NET_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* 간선 — 은닉층 비활성 */}
            {[
              { x1: 50, y1: 50, x2: 170, y2: 80, label: 'w₁', color: C.dim, frozen: true },
              { x1: 50, y1: 110, x2: 170, y2: 80, label: 'w₂', color: C.dim, frozen: true },
              { x1: 170, y1: 80, x2: 290, y2: 80, label: 'w₃', color: C.cyan, frozen: false },
            ].map((e, i) => (
              <g key={i}>
                <line x1={e.x1 + 22} y1={e.y1} x2={e.x2 - 22} y2={e.y2}
                  stroke={e.color} strokeWidth={e.frozen ? 1.5 : 2.5}
                  opacity={e.frozen ? 0.3 : 0.7}
                  strokeDasharray={e.frozen ? '4 3' : 'none'}
                />
                <text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 8}
                  textAnchor="middle" fill={e.color}
                  fontSize={10} fontFamily={mono} fontWeight={600}
                  opacity={e.frozen ? 0.4 : 1}
                >
                  {e.label} {e.frozen ? '\uD83D\uDD12' : ''}
                </text>
              </g>
            ))}
            {/* 노드 */}
            {[
              { cx: 50, cy: 50, label: 'x₁', color: C.blue, frozen: false },
              { cx: 50, cy: 110, label: 'x₂', color: C.blue, frozen: false },
              { cx: 170, cy: 80, label: 'h₁', color: C.dim, frozen: true },
              { cx: 290, cy: 80, label: 'ŷ', color: C.amber, frozen: false },
            ].map((n, i) => (
              <g key={i}>
                <circle cx={n.cx} cy={n.cy} r={20}
                  fill={n.frozen ? 'rgba(100,116,139,0.1)' : `${n.color}18`}
                  stroke={n.color} strokeWidth={n.frozen ? 1.5 : 2}
                  opacity={n.frozen ? 0.5 : 1}
                />
                <text x={n.cx} y={n.cy + 4} textAnchor="middle"
                  fill={n.color} fontSize={11} fontWeight={700}
                  opacity={n.frozen ? 0.5 : 1}
                >{n.label}</text>
              </g>
            ))}
            <text x={NET_W / 2} y={NET_H - 5} textAnchor="middle"
              fill={C.rose} fontSize={11} fontWeight={600}>
              출력층만 업데이트 (은닉층 고정)
            </text>
          </svg>
        </div>
      </div>

      {/* ─── Toggle + Train Button ─── */}
      <div style={{
        display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center',
        flexWrap: 'wrap', marginBottom: 20,
      }}>
        {/* Toggle switch */}
        <div
          onClick={() => setBackpropOn(!backpropOn)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderRadius: 12,
            background: 'rgba(30,41,59,0.6)',
            border: `1px solid ${C.borderLight}`,
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>역전파</span>
          <div style={{
            width: 48, height: 26, borderRadius: 13, position: 'relative',
            background: backpropOn ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)',
            border: `1px solid ${backpropOn ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.3)'}`,
            transition: 'all 0.3s',
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: backpropOn ? C.emerald : C.rose,
              position: 'absolute', top: 2,
              left: backpropOn ? 26 : 2,
              transition: 'all 0.3s',
              boxShadow: `0 0 8px ${backpropOn ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
            }} />
          </div>
          <span style={{
            color: backpropOn ? C.emerald : C.rose,
            fontSize: 13, fontWeight: 700,
          }}>
            {backpropOn ? 'ON' : 'OFF'}
          </span>
        </div>

        <button
          onClick={handleTrain10}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: C.violet,
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          학습 50회 비교 시작
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
      </div>

      {/* ─── Loss Graph ─── */}
      {hasRun && (
        <div style={{
          background: C.card,
          borderRadius: 16,
          border: `1px solid ${C.borderLight}`,
          padding: 16,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 10,
          }}>
            <span style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>
              손실 변화 비교
            </span>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 3, borderRadius: 2, background: C.blue }} />
                <span style={{ color: C.blue, fontSize: 11, fontWeight: 600 }}>역전파 ON</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 16, height: 3, borderRadius: 2, background: C.rose }} />
                <span style={{ color: C.rose, fontSize: 11, fontWeight: 600 }}>역전파 OFF</span>
              </div>
            </div>
          </div>

          <svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {/* 격자 */}
            {[0, 0.25, 0.5, 0.75, 1].map(t => {
              const y = GRAPH_PAD.top + plotH * (1 - t);
              const val = (maxLoss * t).toFixed(3);
              return (
                <g key={t}>
                  <line x1={GRAPH_PAD.left} y1={y} x2={GRAPH_PAD.left + plotW} y2={y}
                    stroke={C.borderLight} strokeWidth={0.5} />
                  <text x={GRAPH_PAD.left - 6} y={y + 3} textAnchor="end"
                    fill={C.dim} fontSize={9} fontFamily={mono}>{val}</text>
                </g>
              );
            })}

            {/* X축 라벨 */}
            {[0, 10, 20, 30, 40, 50].map(ep => {
              const x = GRAPH_PAD.left + (ep / 49) * plotW;
              return (
                <text key={ep} x={x} y={GRAPH_H - 8} textAnchor="middle"
                  fill={C.dim} fontSize={9} fontFamily={mono}>{ep}</text>
              );
            })}
            <text x={GRAPH_PAD.left + plotW / 2} y={GRAPH_H - 0}
              textAnchor="middle" fill={C.muted} fontSize={10}>학습 횟수</text>
            <text x={8} y={GRAPH_PAD.top + plotH / 2}
              textAnchor="middle" fill={C.muted} fontSize={10}
              transform={`rotate(-90, 8, ${GRAPH_PAD.top + plotH / 2})`}>Loss</text>

            {/* ON 곡선 */}
            <path d={buildPath(lossesOn, maxLoss)} fill="none"
              stroke={C.blue} strokeWidth={2.5} strokeLinecap="round" />

            {/* OFF 곡선 */}
            <path d={buildPath(lossesOff, maxLoss)} fill="none"
              stroke={C.rose} strokeWidth={2.5} strokeLinecap="round"
              strokeDasharray="6 3" />
          </svg>

          {/* 결과 비교 */}
          <div style={{
            display: 'flex', gap: 12, marginTop: 14, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <div style={{
              padding: '10px 20px', borderRadius: 10,
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)',
              textAlign: 'center',
            }}>
              <div style={{ color: C.dim, fontSize: 10, marginBottom: 4 }}>역전파 ON 최종 손실</div>
              <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.blue }}>
                {lossesOn.length > 0 ? lossesOn[lossesOn.length - 1].toFixed(4) : '—'}
              </div>
            </div>
            <div style={{
              padding: '10px 20px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              textAlign: 'center',
            }}>
              <div style={{ color: C.dim, fontSize: 10, marginBottom: 4 }}>역전파 OFF 최종 손실</div>
              <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.rose }}>
                {lossesOff.length > 0 ? lossesOff[lossesOff.length - 1].toFixed(4) : '—'}
              </div>
            </div>
          </div>

          {/* 교육적 메시지 */}
          <div style={{
            marginTop: 14, padding: '12px 16px', borderRadius: 12,
            background: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.15)',
            fontSize: 13, color: C.muted, lineHeight: 1.7, textAlign: 'center',
          }}>
            <strong style={{ color: C.violet }}>역전파 OFF</strong>일 때 손실이
            더 이상 줄어들지 않고 <strong style={{ color: C.rose }}>정체(plateau)</strong>됩니다.
            <br />은닉층 가중치가 고정되어 있어 네트워크의 표현력이 제한되기 때문입니다.
            <br /><strong style={{ color: C.emerald }}>역전파는 깊은 층까지 학습 신호를 전달하는 핵심 알고리즘</strong>입니다.
          </div>
        </div>
      )}
    </div>
  );
}
