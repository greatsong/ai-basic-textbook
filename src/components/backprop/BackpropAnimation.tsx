import { useState, useRef, useCallback, useEffect } from 'react';

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
const NET = {
  x1: 1.0, x2: 0.5,
  w1: 0.3, w2: 0.7, b1: 0.1,
  w3: 0.5, b2: 0.2,
  target: 1.0,
};

// ─── Sigmoid ───
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ─── 순전파 계산 ───
const z1 = NET.w1 * NET.x1 + NET.w2 * NET.x2 + NET.b1;
const a1 = sigmoid(z1);
const z2 = NET.w3 * a1 + NET.b2;
const yHat = sigmoid(z2);
const loss = (NET.target - yHat) ** 2;

// ─── 역전파 (MSE loss) ───
// dL/dy_hat = -2(t - y_hat)
const dL_dyHat = -2 * (NET.target - yHat);
// dy_hat/dz2 = y_hat(1 - y_hat)
const dyHat_dz2 = yHat * (1 - yHat);
// dL/dz2
const dL_dz2 = dL_dyHat * dyHat_dz2;
// dL/dw3 = dL/dz2 * a1
const dL_dw3 = dL_dz2 * a1;
// dL/db2 = dL/dz2
const dL_db2 = dL_dz2;
// dL/da1 = dL/dz2 * w3
const dL_da1 = dL_dz2 * NET.w3;
// da1/dz1 = a1(1 - a1)
const da1_dz1 = a1 * (1 - a1);
// dL/dz1
const dL_dz1 = dL_da1 * da1_dz1;
// dL/dw1 = dL/dz1 * x1
const dL_dw1 = dL_dz1 * NET.x1;
// dL/dw2 = dL/dz1 * x2
const dL_dw2 = dL_dz1 * NET.x2;
// dL/db1 = dL/dz1
const dL_db1 = dL_dz1;

// 학습률
const LR = 0.5;

// 새 가중치
const newW1 = NET.w1 - LR * dL_dw1;
const newW2 = NET.w2 - LR * dL_dw2;
const newB1 = NET.b1 - LR * dL_db1;
const newW3 = NET.w3 - LR * dL_dw3;
const newB2 = NET.b2 - LR * dL_db2;

// ─── 애니메이션 단계 ───
type Phase = 'idle' | 'forward' | 'error' | 'backward' | 'update';

const PHASE_LABELS: Record<Phase, string> = {
  idle: '준비',
  forward: '순전파: 입력 → 출력',
  error: '오차 계산',
  backward: '역전파: 기울기 전달',
  update: '가중치 업데이트',
};

// ─── SVG 레이아웃 ───
const SVG_W = 520;
const SVG_H = 280;

export default function BackpropAnimation() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [subStep, setSubStep] = useState(0); // 0~1 progress within phase
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  // 단계별 지속 시간 (ms)
  const phaseDurations: Record<Phase, number> = {
    idle: 0,
    forward: 1500 / speed,
    error: 1000 / speed,
    backward: 2000 / speed,
    update: 1200 / speed,
  };

  const phaseOrder: Phase[] = ['forward', 'error', 'backward', 'update'];

  const stopAnimation = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const advancePhase = useCallback(() => {
    setPhase(prev => {
      const idx = phaseOrder.indexOf(prev);
      if (idx < phaseOrder.length - 1) {
        return phaseOrder[idx + 1];
      }
      setIsPlaying(false);
      return prev;
    });
    setSubStep(0);
    startTimeRef.current = performance.now();
  }, []);

  const animate = useCallback((now: number) => {
    if (!startTimeRef.current) startTimeRef.current = now;
    const elapsed = now - startTimeRef.current;
    const duration = phaseDurations[phase] || 1000;
    const progress = Math.min(elapsed / duration, 1);
    setSubStep(progress);

    if (progress >= 1) {
      advancePhase();
    }
    if (isPlaying) {
      animRef.current = requestAnimationFrame(animate);
    }
  }, [phase, isPlaying, speed]);

  useEffect(() => {
    if (isPlaying && phase !== 'idle') {
      animRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, phase, animate]);

  const handlePlay = useCallback(() => {
    if (phase === 'idle' || phase === 'update') {
      setPhase('forward');
      setSubStep(0);
      startTimeRef.current = performance.now();
    }
    setIsPlaying(true);
  }, [phase]);

  const handleStepForward = useCallback(() => {
    stopAnimation();
    if (phase === 'idle') {
      setPhase('forward');
    } else {
      const idx = phaseOrder.indexOf(phase);
      if (idx < phaseOrder.length - 1) {
        setPhase(phaseOrder[idx + 1]);
      }
    }
    setSubStep(1);
  }, [phase, stopAnimation]);

  const handleReset = useCallback(() => {
    stopAnimation();
    setPhase('idle');
    setSubStep(0);
  }, [stopAnimation]);

  // ─── 노드 좌표 ───
  const nodes = {
    x1: { cx: 60, cy: 90 },
    x2: { cx: 60, cy: 190 },
    h1: { cx: 260, cy: 140 },
    out: { cx: 460, cy: 140 },
  };

  // ─── 간선 활성화 상태 계산 ───
  const forwardDone = phase === 'error' || phase === 'backward' || phase === 'update';
  const forwardActive = phase === 'forward';
  const backwardActive = phase === 'backward';
  const backwardDone = phase === 'update';
  const errorActive = phase === 'error';
  const updateActive = phase === 'update';

  // 기울기 크기에 따른 선 두께
  const gradScale = (g: number) => Math.max(1.5, Math.min(5, Math.abs(g) * 15));

  // 가중치 테이블 데이터
  const weightData = [
    { name: 'w₁', old: NET.w1, new: newW1, grad: dL_dw1 },
    { name: 'w₂', old: NET.w2, new: newW2, grad: dL_dw2 },
    { name: 'b₁', old: NET.b1, new: newB1, grad: dL_db1 },
    { name: 'w₃', old: NET.w3, new: newW3, grad: dL_dw3 },
    { name: 'b₂', old: NET.b2, new: newB2, grad: dL_db2 },
  ];

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
          <span style={{ fontSize: 14 }}>&#8592;</span>
          <span style={{ color: C.pink, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>역전파 애니메이션</span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          오차 신호가 거꾸로 흐르는 과정을 관찰하세요
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          순전파 → 오차 계산 → 역전파 → 가중치 업데이트
        </p>
      </div>

      {/* ─── Phase indicator ─── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {phaseOrder.map((p, i) => {
          const isCurrent = phase === p;
          const isDone = phaseOrder.indexOf(phase) > i || (phase === p && subStep >= 1);
          return (
            <div key={p} style={{
              padding: '6px 14px', borderRadius: 8,
              background: isCurrent ? 'rgba(139,92,246,0.2)' : isDone ? 'rgba(16,185,129,0.1)' : 'rgba(30,41,59,0.5)',
              border: `1px solid ${isCurrent ? 'rgba(139,92,246,0.4)' : isDone ? 'rgba(16,185,129,0.2)' : C.borderLight}`,
              fontSize: 11, fontWeight: 600,
              color: isCurrent ? C.violet : isDone ? C.emerald : C.dim,
              transition: 'all 0.3s',
            }}>
              {isDone && !isCurrent ? '\u2713 ' : ''}{PHASE_LABELS[p]}
            </div>
          );
        })}
      </div>

      {/* ─── SVG Network ─── */}
      <div style={{
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.borderLight}`,
        padding: 12,
        marginBottom: 16,
      }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <filter id="bp-glow-blue">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="bp-glow-red">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker id="bp-arrow-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={C.blue} />
            </marker>
            <marker id="bp-arrow-red" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
              <path d="M8,0 L8,6 L0,3 z" fill={C.rose} />
            </marker>
            <style>{`
              @keyframes bp-flow-forward {
                0% { stroke-dashoffset: 30; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes bp-flow-backward {
                0% { stroke-dashoffset: -30; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes bp-pulse-red {
                0%,100% { opacity: 0.3; r: 30; }
                50% { opacity: 1; r: 38; }
              }
              @keyframes bp-glow-update {
                0%,100% { opacity: 0.6; }
                50% { opacity: 1; }
              }
            `}</style>
          </defs>

          {/* ─── 순전파 간선 (파란색) ─── */}
          {[
            { from: nodes.x1, to: nodes.h1, label: `w₁=${NET.w1}`, grad: dL_dw1 },
            { from: nodes.x2, to: nodes.h1, label: `w₂=${NET.w2}`, grad: dL_dw2 },
            { from: nodes.h1, to: nodes.out, label: `w₃=${NET.w3}`, grad: dL_dw3 },
          ].map((e, i) => {
            const fwdShow = forwardActive || forwardDone;
            const bwdShow = backwardActive || backwardDone;
            return (
              <g key={`edge-${i}`}>
                {/* 순전파 화살표 */}
                <line
                  x1={e.from.cx + 28} y1={e.from.cy}
                  x2={e.to.cx - 28} y2={e.to.cy}
                  stroke={C.blue}
                  strokeWidth={fwdShow ? 2.5 : 1.5}
                  opacity={fwdShow ? 0.8 : 0.25}
                  strokeDasharray={forwardActive ? '6 4' : 'none'}
                  markerEnd="url(#bp-arrow-blue)"
                  style={forwardActive ? { animation: 'bp-flow-forward 0.6s linear infinite' } : undefined}
                />
                {/* 가중치 라벨 */}
                <text
                  x={(e.from.cx + e.to.cx) / 2}
                  y={(e.from.cy + e.to.cy) / 2 - 12}
                  textAnchor="middle" fill={updateActive ? C.emerald : C.muted}
                  fontSize={10} fontFamily={mono} fontWeight={600}
                  style={updateActive ? { animation: 'bp-glow-update 0.8s ease infinite' } : undefined}
                >
                  {updateActive
                    ? `${weightData[i].old.toFixed(3)} → ${weightData[i].new.toFixed(3)}`
                    : e.label
                  }
                </text>
                {/* 역전파 화살표 (아래쪽 오프셋) */}
                {bwdShow && (
                  <line
                    x1={e.to.cx - 28} y1={e.to.cy + 10}
                    x2={e.from.cx + 28} y2={e.from.cy + 10}
                    stroke={C.rose}
                    strokeWidth={gradScale(e.grad)}
                    opacity={backwardActive ? 0.9 : 0.6}
                    strokeDasharray={backwardActive ? '6 4' : 'none'}
                    markerEnd="url(#bp-arrow-red)"
                    style={backwardActive ? { animation: 'bp-flow-backward 0.8s linear infinite' } : undefined}
                  />
                )}
                {/* 기울기 라벨 */}
                {bwdShow && (
                  <text
                    x={(e.from.cx + e.to.cx) / 2}
                    y={(e.from.cy + e.to.cy) / 2 + 26}
                    textAnchor="middle" fill={C.rose}
                    fontSize={9} fontFamily={mono} fontWeight={600}
                  >
                    {`∂L/∂${['w₁', 'w₂', 'w₃'][i]}=${e.grad.toFixed(4)}`}
                  </text>
                )}
              </g>
            );
          })}

          {/* ─── 입력 노드 ─── */}
          {[
            { ...nodes.x1, label: 'x₁', val: NET.x1 },
            { ...nodes.x2, label: 'x₂', val: NET.x2 },
          ].map((n, i) => (
            <g key={`in-${i}`}>
              <circle cx={n.cx} cy={n.cy} r={26}
                fill="rgba(59,130,246,0.12)" stroke={C.blue} strokeWidth={2} />
              <text x={n.cx} y={n.cy - 5} textAnchor="middle" fill={C.blue}
                fontSize={11} fontWeight={700}>{n.label}</text>
              <text x={n.cx} y={n.cy + 12} textAnchor="middle" fill={C.text}
                fontSize={13} fontFamily={mono} fontWeight={700}>{n.val}</text>
            </g>
          ))}

          {/* ─── 은닉 노드 ─── */}
          <g>
            <circle cx={nodes.h1.cx} cy={nodes.h1.cy} r={28}
              fill={forwardDone ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.08)'}
              stroke={C.violet} strokeWidth={2.5}
              filter={forwardDone ? 'url(#bp-glow-blue)' : undefined}
            />
            <text x={nodes.h1.cx} y={nodes.h1.cy - 8} textAnchor="middle"
              fill={C.violet} fontSize={11} fontWeight={700}>h₁</text>
            {forwardDone && (
              <text x={nodes.h1.cx} y={nodes.h1.cy + 10} textAnchor="middle"
                fill={C.text} fontSize={10} fontFamily={mono} fontWeight={600}>
                {a1.toFixed(3)}
              </text>
            )}
            <text x={nodes.h1.cx} y={nodes.h1.cy - 40} textAnchor="middle"
              fill={C.dim} fontSize={9} fontFamily={mono}>b₁={NET.b1}</text>
          </g>

          {/* ─── 출력 노드 ─── */}
          <g>
            <circle cx={nodes.out.cx} cy={nodes.out.cy} r={28}
              fill={forwardDone ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)'}
              stroke={C.amber} strokeWidth={2.5}
              filter={forwardDone ? 'url(#bp-glow-blue)' : undefined}
            />
            {errorActive && (
              <circle cx={nodes.out.cx} cy={nodes.out.cy} r={32}
                fill="none" stroke={C.rose} strokeWidth={3} opacity={0.8}
                style={{ animation: 'bp-pulse-red 1s ease-in-out infinite' }}
              />
            )}
            <text x={nodes.out.cx} y={nodes.out.cy - 8} textAnchor="middle"
              fill={C.amber} fontSize={11} fontWeight={700}>ŷ</text>
            {forwardDone && (
              <text x={nodes.out.cx} y={nodes.out.cy + 10} textAnchor="middle"
                fill={C.text} fontSize={10} fontFamily={mono} fontWeight={600}>
                {yHat.toFixed(3)}
              </text>
            )}
            <text x={nodes.out.cx} y={nodes.out.cy - 40} textAnchor="middle"
              fill={C.dim} fontSize={9} fontFamily={mono}>b₂={NET.b2}</text>
          </g>

          {/* ─── 오차 표시 ─── */}
          {(errorActive || backwardActive || backwardDone || updateActive) && (
            <g>
              <text x={nodes.out.cx} y={nodes.out.cy + 55} textAnchor="middle"
                fill={C.rose} fontSize={11} fontFamily={mono} fontWeight={700}>
                Loss = {loss.toFixed(4)}
              </text>
              <text x={nodes.out.cx} y={nodes.out.cy + 70} textAnchor="middle"
                fill={C.dim} fontSize={9} fontFamily={mono}>
                t={NET.target}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* ─── Controls ─── */}
      <div style={{
        display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16,
      }}>
        <button
          onClick={isPlaying ? () => { stopAnimation(); } : handlePlay}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: isPlaying ? C.amber : C.blue,
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            minWidth: 100,
          }}
        >
          {isPlaying ? '\u23F8 일시정지' : '\u25B6 재생'}
        </button>
        <button
          onClick={handleStepForward}
          disabled={isPlaying || phase === 'update'}
          style={{
            padding: '10px 20px', borderRadius: 10,
            border: `1px solid ${C.borderLight}`,
            background: 'rgba(30,41,59,0.5)',
            color: isPlaying || phase === 'update' ? C.dim : C.text,
            fontSize: 13, fontWeight: 600, cursor: isPlaying ? 'not-allowed' : 'pointer',
          }}
        >
          {'⏭ 다음 단계'}
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
          {'↺ 리셋'}
        </button>

        {/* 속도 조절 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 10,
          background: 'rgba(30,41,59,0.5)',
          border: `1px solid ${C.borderLight}`,
        }}>
          <span style={{ color: C.dim, fontSize: 11 }}>속도</span>
          {[0.5, 1, 2].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                background: speed === s ? 'rgba(139,92,246,0.2)' : 'transparent',
                color: speed === s ? C.violet : C.dim,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* ─── Weight Update Table ─── */}
      <div style={{
        background: C.card,
        borderRadius: 14,
        border: `1px solid ${C.borderLight}`,
        padding: 16,
        overflowX: 'auto',
      }}>
        <div style={{ color: C.dim, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 10 }}>
          가중치 변화 (학습률 η = {LR})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
          <thead>
            <tr>
              {['매개변수', '기존 값', '기울기 (∂L/∂w)', '업데이트', '새 값'].map(h => (
                <th key={h} style={{
                  padding: '8px 10px', textAlign: 'center',
                  borderBottom: `1px solid ${C.borderLight}`,
                  color: C.dim, fontSize: 10, fontWeight: 600,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weightData.map(row => {
              const showUpdate = updateActive;
              return (
                <tr key={row.name}>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: C.text, fontWeight: 700 }}>
                    {row.name}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: C.muted }}>
                    {row.old.toFixed(3)}
                  </td>
                  <td style={{
                    padding: '6px 10px', textAlign: 'center',
                    color: (backwardActive || backwardDone || updateActive) ? C.rose : C.dim,
                    fontWeight: (backwardActive || backwardDone || updateActive) ? 700 : 400,
                  }}>
                    {(backwardActive || backwardDone || updateActive) ? row.grad.toFixed(4) : '—'}
                  </td>
                  <td style={{
                    padding: '6px 10px', textAlign: 'center',
                    color: showUpdate ? C.amber : C.dim,
                  }}>
                    {showUpdate ? `−${LR}×${row.grad.toFixed(4)}` : '—'}
                  </td>
                  <td style={{
                    padding: '6px 10px', textAlign: 'center',
                    color: showUpdate ? C.emerald : C.dim,
                    fontWeight: showUpdate ? 700 : 400,
                  }}>
                    {showUpdate ? row.new.toFixed(4) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
