import { useState, useCallback } from 'react';

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

// 정답 계산
const Z1 = NET.w1 * NET.x1 + NET.w2 * NET.x2 + NET.b1; // 0.75
const A1 = 1 / (1 + Math.exp(-Z1));                       // ≈ 0.679
const Z2 = NET.w3 * A1 + NET.b2;                          // ≈ 0.540
const OUTPUT = 1 / (1 + Math.exp(-Z2));                    // ≈ 0.632
const MSE = (NET.target - OUTPUT) ** 2;                    // ≈ 0.135

const ANSWERS = [
  +Z1.toFixed(3),
  +A1.toFixed(3),
  +Z2.toFixed(3),
  +OUTPUT.toFixed(3),
];

const TOLERANCE = 0.01;

interface StepConfig {
  label: string;
  formula: string;
  hint: string;
  answer: number;
}

const STEPS: StepConfig[] = [
  {
    label: 'Step 1: 은닉층 가중합 z₁',
    formula: 'z₁ = w₁·x₁ + w₂·x₂ + b₁',
    hint: `z₁ = ${NET.w1}×${NET.x1} + ${NET.w2}×${NET.x2} + ${NET.b1} = ?`,
    answer: ANSWERS[0],
  },
  {
    label: 'Step 2: 시그모이드 적용 a₁',
    formula: 'a₁ = σ(z₁) = 1/(1+e⁻ᶻ¹)',
    hint: `a₁ = σ(${Z1.toFixed(2)}) = 1/(1+e^(-${Z1.toFixed(2)})) = ?`,
    answer: ANSWERS[1],
  },
  {
    label: 'Step 3: 출력층 가중합 z₂',
    formula: 'z₂ = w₃·a₁ + b₂',
    hint: `z₂ = ${NET.w3}×${A1.toFixed(3)} + ${NET.b2} = ?`,
    answer: ANSWERS[2],
  },
  {
    label: 'Step 4: 시그모이드 적용 ŷ',
    formula: 'ŷ = σ(z₂)',
    hint: `ŷ = σ(${Z2.toFixed(3)}) = 1/(1+e^(-${Z2.toFixed(3)})) = ?`,
    answer: ANSWERS[3],
  },
];

// ─── SVG 네트워크 레이아웃 ───
const SVG_W = 480;
const SVG_H = 260;

const NODES = {
  x1: { cx: 60, cy: 80, label: 'x₁', val: NET.x1 },
  x2: { cx: 60, cy: 180, label: 'x₂', val: NET.x2 },
  h1: { cx: 240, cy: 130, label: 'h₁' },
  out: { cx: 420, cy: 130, label: 'ŷ' },
};

const EDGES = [
  { from: NODES.x1, to: NODES.h1, label: `w₁=${NET.w1}`, color: C.orange },
  { from: NODES.x2, to: NODES.h1, label: `w₂=${NET.w2}`, color: C.pink },
  { from: NODES.h1, to: NODES.out, label: `w₃=${NET.w3}`, color: C.cyan },
];

export default function ForwardPassCalculator() {
  const [currentStep, setCurrentStep] = useState(0);
  const [inputs, setInputs] = useState(['', '', '', '']);
  const [results, setResults] = useState<('correct' | 'wrong' | null)[]>([null, null, null, null]);
  const [showHint, setShowHint] = useState([false, false, false, false]);
  const [allDone, setAllDone] = useState(false);

  const handleSubmit = useCallback((stepIdx: number) => {
    const val = parseFloat(inputs[stepIdx]);
    if (isNaN(val)) return;
    const correct = Math.abs(val - STEPS[stepIdx].answer) <= TOLERANCE;
    const newResults = [...results];
    newResults[stepIdx] = correct ? 'correct' : 'wrong';
    setResults(newResults);
    if (correct) {
      if (stepIdx < 3) {
        setTimeout(() => setCurrentStep(stepIdx + 1), 600);
      } else {
        setTimeout(() => setAllDone(true), 600);
      }
    } else {
      const newHints = [...showHint];
      newHints[stepIdx] = true;
      setShowHint(newHints);
    }
  }, [inputs, results, showHint]);

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setInputs(['', '', '', '']);
    setResults([null, null, null, null]);
    setShowHint([false, false, false, false]);
    setAllDone(false);
  }, []);

  // 완료된 단계의 값 (노드에 표시)
  const completedVals: (number | null)[] = [
    results[0] === 'correct' ? ANSWERS[0] : null,
    results[1] === 'correct' ? ANSWERS[1] : null,
    results[2] === 'correct' ? ANSWERS[2] : null,
    results[3] === 'correct' ? ANSWERS[3] : null,
  ];

  // 노드 활성화 상태
  const h1Active = results[1] === 'correct';
  const outActive = results[3] === 'correct';

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
          <span style={{ fontSize: 14 }}>&#9654;</span>
          <span style={{ color: '#93c5fd', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>순전파 계산기</span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          2-1-1 신경망의 순전파를 직접 계산해 보세요
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          각 단계의 결과를 입력하면 다음 단계로 진행됩니다 (오차 허용: ±0.01)
        </p>
      </div>

      {/* ─── SVG Network ─── */}
      <div style={{
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.borderLight}`,
        padding: 12,
        marginBottom: 20,
      }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <filter id="fp-glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <style>{`
              @keyframes fp-pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
            `}</style>
          </defs>

          {/* 간선 */}
          {EDGES.map((e, i) => (
            <g key={i}>
              <line
                x1={e.from.cx} y1={e.from.cy} x2={e.to.cx} y2={e.to.cy}
                stroke={e.color} strokeWidth={2.5} opacity={0.6}
              />
              <text
                x={(e.from.cx + e.to.cx) / 2}
                y={(e.from.cy + e.to.cy) / 2 - 10}
                textAnchor="middle" fill={e.color} fontSize={11} fontFamily={mono}
                fontWeight={700}
              >
                {e.label}
              </text>
            </g>
          ))}

          {/* 편향 라벨 */}
          <text x={NODES.h1.cx} y={NODES.h1.cy - 38} textAnchor="middle"
            fill={C.violet} fontSize={10} fontFamily={mono}>b₁={NET.b1}</text>
          <text x={NODES.out.cx} y={NODES.out.cy - 38} textAnchor="middle"
            fill={C.violet} fontSize={10} fontFamily={mono}>b₂={NET.b2}</text>

          {/* 입력 노드 */}
          {[NODES.x1, NODES.x2].map((n, i) => (
            <g key={`input-${i}`}>
              <circle cx={n.cx} cy={n.cy} r={26} fill="rgba(59,130,246,0.15)"
                stroke={C.blue} strokeWidth={2} />
              <text x={n.cx} y={n.cy - 6} textAnchor="middle" fill={C.blue}
                fontSize={12} fontWeight={700}>{n.label}</text>
              <text x={n.cx} y={n.cy + 12} textAnchor="middle" fill={C.text}
                fontSize={13} fontFamily={mono} fontWeight={700}>{n.val}</text>
            </g>
          ))}

          {/* 은닉 노드 */}
          <g>
            <circle cx={NODES.h1.cx} cy={NODES.h1.cy} r={28}
              fill={h1Active ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.15)'}
              stroke={h1Active ? C.emerald : C.violet}
              strokeWidth={2.5}
              filter={h1Active ? 'url(#fp-glow)' : undefined}
              style={h1Active ? { animation: 'fp-pulse 1.5s ease-in-out infinite' } : undefined}
            />
            <text x={NODES.h1.cx} y={NODES.h1.cy - 8} textAnchor="middle"
              fill={h1Active ? C.emerald : C.violet} fontSize={11} fontWeight={700}>h₁</text>
            {completedVals[0] !== null && (
              <text x={NODES.h1.cx} y={NODES.h1.cy + 4} textAnchor="middle"
                fill={C.dim} fontSize={9} fontFamily={mono}>z={completedVals[0]}</text>
            )}
            {completedVals[1] !== null && (
              <text x={NODES.h1.cx} y={NODES.h1.cy + 16} textAnchor="middle"
                fill={C.emerald} fontSize={10} fontFamily={mono} fontWeight={700}>a={completedVals[1]}</text>
            )}
          </g>

          {/* 출력 노드 */}
          <g>
            <circle cx={NODES.out.cx} cy={NODES.out.cy} r={28}
              fill={outActive ? 'rgba(16,185,129,0.25)' : 'rgba(249,115,22,0.12)'}
              stroke={outActive ? C.emerald : C.amber}
              strokeWidth={2.5}
              filter={outActive ? 'url(#fp-glow)' : undefined}
              style={outActive ? { animation: 'fp-pulse 1.5s ease-in-out infinite' } : undefined}
            />
            <text x={NODES.out.cx} y={NODES.out.cy - 8} textAnchor="middle"
              fill={outActive ? C.emerald : C.amber} fontSize={11} fontWeight={700}>ŷ</text>
            {completedVals[2] !== null && (
              <text x={NODES.out.cx} y={NODES.out.cy + 4} textAnchor="middle"
                fill={C.dim} fontSize={9} fontFamily={mono}>z={completedVals[2]}</text>
            )}
            {completedVals[3] !== null && (
              <text x={NODES.out.cx} y={NODES.out.cy + 16} textAnchor="middle"
                fill={C.emerald} fontSize={10} fontFamily={mono} fontWeight={700}>ŷ={completedVals[3]}</text>
            )}
          </g>

          {/* σ 라벨 */}
          <text x={NODES.h1.cx + 40} y={NODES.h1.cy + 30} fill={C.dim} fontSize={10}
            fontFamily={mono}>σ</text>
          <text x={NODES.out.cx - 40} y={NODES.out.cy + 30} fill={C.dim} fontSize={10}
            fontFamily={mono}>σ</text>

          {/* 정답 라벨 */}
          <text x={SVG_W - 20} y={NODES.out.cy + 50} textAnchor="end"
            fill={C.muted} fontSize={10} fontFamily={mono}>
            정답 t = {NET.target}
          </text>
        </svg>
      </div>

      {/* ─── Step-by-step inputs ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEPS.map((step, idx) => {
          const active = idx === currentStep;
          const done = results[idx] === 'correct';
          const wrong = results[idx] === 'wrong';
          const locked = idx > currentStep;

          return (
            <div key={idx} style={{
              padding: '14px 18px',
              borderRadius: 14,
              background: done ? 'rgba(16,185,129,0.08)' : active ? 'rgba(59,130,246,0.08)' : 'rgba(30,41,59,0.4)',
              border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : active ? 'rgba(59,130,246,0.3)' : C.borderLight}`,
              opacity: locked ? 0.4 : 1,
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: done ? C.emerald : active ? C.blue : 'rgba(100,116,139,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#fff',
                    transition: 'background 0.3s',
                  }}>
                    {done ? '\u2713' : idx + 1}
                  </div>
                  <span style={{ color: done ? C.emerald : active ? C.text : C.dim, fontSize: 14, fontWeight: 600 }}>
                    {step.label}
                  </span>
                </div>
                <span style={{ fontFamily: mono, fontSize: 12, color: C.muted }}>
                  {step.formula}
                </span>
              </div>

              {active && !done && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number"
                      step="0.001"
                      value={inputs[idx]}
                      onChange={e => {
                        const newInputs = [...inputs];
                        newInputs[idx] = e.target.value;
                        setInputs(newInputs);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSubmit(idx);
                      }}
                      placeholder="계산 결과 입력..."
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: wrong ? `2px solid ${C.rose}` : `1px solid ${C.borderLight}`,
                        background: 'rgba(15,23,42,0.8)',
                        color: C.text,
                        fontFamily: mono,
                        fontSize: 15,
                        outline: 'none',
                        transition: 'border 0.2s',
                      }}
                    />
                    <button
                      onClick={() => handleSubmit(idx)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 10,
                        border: 'none',
                        background: C.blue,
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                    >
                      확인
                    </button>
                  </div>
                  {wrong && (
                    <div style={{
                      marginTop: 8, padding: '8px 12px', borderRadius: 8,
                      background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`,
                      fontSize: 12, color: C.rose,
                    }}>
                      오답입니다. 다시 계산해 보세요!
                    </div>
                  )}
                  {showHint[idx] && (
                    <div style={{
                      marginTop: 8, padding: '10px 12px', borderRadius: 8,
                      background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.2)`,
                      fontSize: 12, color: C.amber, fontFamily: mono,
                    }}>
                      힌트: {step.hint}
                    </div>
                  )}
                </div>
              )}

              {done && (
                <div style={{
                  marginTop: 4, fontFamily: mono, fontSize: 14,
                  color: C.emerald, fontWeight: 700,
                }}>
                  = {STEPS[idx].answer.toFixed(3)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── MSE Result ─── */}
      {allDone && (
        <div style={{
          marginTop: 20, padding: '20px', borderRadius: 16,
          background: 'rgba(139,92,246,0.08)', border: `1px solid rgba(139,92,246,0.2)`,
          textAlign: 'center',
        }}>
          <div style={{ color: C.violet, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            모든 순전파 계산 완료!
          </div>
          <div style={{ fontFamily: mono, fontSize: 14, color: C.muted, marginBottom: 12, lineHeight: 1.8 }}>
            MSE = (t - ŷ)² = ({NET.target} - {OUTPUT.toFixed(3)})² = <span style={{ color: C.rose, fontWeight: 700, fontSize: 18 }}>{MSE.toFixed(3)}</span>
          </div>
          <div style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'rgba(15,23,42,0.5)',
            fontSize: 13, color: C.muted, lineHeight: 1.7,
          }}>
            예측값 <span style={{ color: C.amber, fontWeight: 700 }}>{OUTPUT.toFixed(3)}</span>과
            정답 <span style={{ color: C.emerald, fontWeight: 700 }}>{NET.target}</span> 사이의
            오차가 <span style={{ color: C.rose, fontWeight: 700 }}>{MSE.toFixed(3)}</span>입니다.
            <br />이 오차를 줄이려면 <strong style={{ color: C.violet }}>역전파(Backpropagation)</strong>로
            가중치를 조정해야 합니다.
          </div>
          <button
            onClick={handleReset}
            style={{
              marginTop: 14, padding: '10px 24px', borderRadius: 10,
              border: `1px solid ${C.borderLight}`,
              background: 'rgba(30,41,59,0.5)',
              color: C.muted, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            다시 풀기
          </button>
        </div>
      )}
    </div>
  );
}
