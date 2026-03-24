import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

type Mode = 'AND' | 'OR' | 'XOR';

interface DataPoint { x1: number; x2: number; label: number }

const ALL_DATA: Record<Mode, DataPoint[]> = {
  AND: [
    { x1: 0, x2: 0, label: 0 },
    { x1: 0, x2: 1, label: 0 },
    { x1: 1, x2: 0, label: 0 },
    { x1: 1, x2: 1, label: 1 },
  ],
  OR: [
    { x1: 0, x2: 0, label: 0 },
    { x1: 0, x2: 1, label: 1 },
    { x1: 1, x2: 0, label: 1 },
    { x1: 1, x2: 1, label: 1 },
  ],
  XOR: [
    { x1: 0, x2: 0, label: 0 },
    { x1: 0, x2: 1, label: 1 },
    { x1: 1, x2: 0, label: 1 },
    { x1: 1, x2: 1, label: 0 },
  ],
};

interface Props {
  /** 사용할 모드 목록 (기본: AND, OR) */
  modes?: Mode[];
  /** 헤더 제목 커스텀 */
  title?: string;
  /** 헤더 설명 커스텀 */
  subtitle?: string;
}

interface StepInfo {
  x1: number; x2: number;
  label: number; pred: number;
  correct: boolean;
  z: number;
  // Before update
  w1Before: number; w2Before: number; bBefore: number;
  // After update
  w1After: number; w2After: number; bAfter: number;
  // Deltas
  dw1: number; dw2: number; db: number;
  error: number; // label - pred
  epoch: number; idx: number;
}

// SVG
const W = 320;
const H = 280;
const PAD = 40;
const toSvg = (v: number) => PAD + v * (W - 2 * PAD);
const toSvgY = (v: number) => H - PAD - v * (H - 2 * PAD);

// Color constants
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
};

const mono = 'var(--sl-font-mono, monospace)';

export default function PerceptronLearning({
  modes = ['AND', 'OR'],
  title,
  subtitle,
}: Props) {
  const availModes = modes as Mode[];
  const isXorMode = availModes.includes('XOR');
  const maxXorSteps = 200;

  const [mode, setMode] = useState<Mode>(availModes[0]);
  const [w1, setW1] = useState(0);
  const [w2, setW2] = useState(0);
  const [b, setB] = useState(0);
  const [running, setRunning] = useState(false);
  const [converged, setConverged] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [currentStep, setCurrentStep] = useState<StepInfo | null>(null);
  const [history, setHistory] = useState<StepInfo[]>([]);
  const [speed, setSpeed] = useState(700);
  const [steps, setSteps] = useState(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const st = useRef({ w1: 0, w2: 0, b: 0, epoch: 0, idx: 0, streak: 0, steps: 0 });
  const histRef = useRef<HTMLDivElement>(null);

  const points = ALL_DATA[mode];

  const results = useMemo(() =>
    points.map((p) => {
      const z = w1 * p.x1 + w2 * p.x2 + b;
      return { ...p, pred: z >= 0 ? 1 : 0, correct: (z >= 0 ? 1 : 0) === p.label };
    }),
  [w1, w2, b, points]);

  const accuracy = results.filter((r) => r.correct).length;

  const boundary = useMemo(() => {
    if (Math.abs(w2) < 0.01 && Math.abs(w1) < 0.01) return null;
    if (Math.abs(w2) >= 0.01) {
      return {
        x1: -0.3, y1: -(w1 * (-0.3) + b) / w2,
        x2: 1.3, y2: -(w1 * 1.3 + b) / w2,
      };
    }
    const xv = -b / w1;
    return { x1: xv, y1: -0.3, x2: xv, y2: 1.3 };
  }, [w1, w2, b]);

  const clearState = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setW1(0); setW2(0); setB(0);
    setRunning(false); setConverged(false);
    setEpoch(0); setActiveIdx(-1);
    setCurrentStep(null); setHistory([]);
    setSteps(0);
    st.current = { w1: 0, w2: 0, b: 0, epoch: 0, idx: 0, streak: 0, steps: 0 };
  }, []);

  const switchMode = useCallback((m: Mode) => {
    clearState();
    setMode(m);
  }, [clearState]);

  const doStep = useCallback(() => {
    const s = st.current;
    const pts = ALL_DATA[mode];
    const p = pts[s.idx];

    const z = s.w1 * p.x1 + s.w2 * p.x2 + s.b;
    const pred = z >= 0 ? 1 : 0;
    const correct = pred === p.label;

    const w1Before = s.w1, w2Before = s.w2, bBefore = s.b;
    let dw1 = 0, dw2 = 0, db = 0;
    const error = p.label - pred;

    if (!correct) {
      dw1 = error * p.x1;
      dw2 = error * p.x2;
      db = error;
      s.w1 += dw1;
      s.w2 += dw2;
      s.b += db;
      s.streak = 0;
    } else {
      s.streak++;
    }
    s.steps++;

    const info: StepInfo = {
      x1: p.x1, x2: p.x2, label: p.label, pred, correct, z,
      w1Before, w2Before, bBefore,
      w1After: s.w1, w2After: s.w2, bAfter: s.b,
      dw1, dw2, db, error,
      epoch: s.epoch, idx: s.idx,
    };

    const curIdx = s.idx;
    s.idx++;
    if (s.idx >= pts.length) { s.idx = 0; s.epoch++; }

    // Update state
    setW1(s.w1); setW2(s.w2); setB(s.b);
    setEpoch(s.epoch); setActiveIdx(curIdx);
    setSteps(s.steps); setCurrentStep(info);
    setHistory(prev => [...prev.slice(-11), info]);

    if (s.streak >= pts.length) {
      setConverged(true); setRunning(false);
      return;
    }
    // XOR: auto-stop after maxXorSteps
    if (mode === 'XOR' && s.steps >= maxXorSteps) {
      setRunning(false);
      return;
    }
    timer.current = setTimeout(doStep, speed);
  }, [mode, speed, maxXorSteps]);

  const start = useCallback(() => {
    if (converged) return;
    setRunning(true);
    timer.current = setTimeout(doStep, 200);
  }, [doStep, converged]);

  const pause = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setRunning(false);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (running) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(doStep, speed);
    }
  }, [speed]);
  useEffect(() => {
    if (histRef.current) histRef.current.scrollTop = histRef.current.scrollHeight;
  }, [history]);

  const accColor = accuracy === 4 ? C.emerald : accuracy >= 3 ? C.amber : C.rose;

  // ─── Explanation panel ───
  const ExplanationPanel = () => {
    const s = currentStep;
    if (!s) return (
      <div style={{
        padding: '16px', borderRadius: 14,
        background: 'rgba(99,102,241,0.06)',
        border: `1px dashed rgba(99,102,241,0.3)`,
        textAlign: 'center',
      }}>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          "학습 시작"을 누르면 매 스텝의<br />가중치 변화 과정이 여기에 표시됩니다
        </p>
      </div>
    );

    const sign = (n: number) => n > 0 ? '+' : n < 0 ? '' : '';
    const clr = (n: number) => n > 0 ? C.emerald : n < 0 ? C.rose : C.dim;

    return (
      <div style={{
        borderRadius: 14,
        background: s.correct
          ? 'rgba(16,185,129,0.06)'
          : 'rgba(239,68,68,0.06)',
        border: `1px solid ${s.correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
        overflow: 'hidden',
      }}>
        {/* Step header */}
        <div style={{
          padding: '10px 14px',
          background: s.correct
            ? 'rgba(16,185,129,0.08)'
            : 'rgba(239,68,68,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: s.correct ? C.emerald : C.rose }}>
            {s.correct ? '✓ 맞음 — 가중치 유지' : '✗ 틀림 — 가중치 수정!'}
          </span>
          <span style={{ fontSize: 10, color: C.dim, fontFamily: mono }}>
            스텝 {steps}
          </span>
        </div>

        <div style={{ padding: '12px 14px' }}>
          {/* 1. Calculation */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 4 }}>계산</div>
            <div style={{ fontSize: 13, fontFamily: mono, color: C.text, lineHeight: 1.8 }}>
              <span style={{ color: C.orange }}>{s.w1Before}</span>
              <span style={{ color: C.dim }}>×</span>
              <span style={{ color: C.muted }}>{s.x1}</span>
              <span style={{ color: C.dim }}> + </span>
              <span style={{ color: C.orange }}>{s.w2Before}</span>
              <span style={{ color: C.dim }}>×</span>
              <span style={{ color: C.muted }}>{s.x2}</span>
              <span style={{ color: C.dim }}> + (</span>
              <span style={{ color: C.pink }}>{s.bBefore}</span>
              <span style={{ color: C.dim }}>) = </span>
              <span style={{ color: C.text, fontWeight: 700 }}>{s.z.toFixed(1)}</span>
              <span style={{ color: C.dim }}> → </span>
              <span style={{
                color: s.pred === 1 ? '#ef4444' : '#3b82f6',
                fontWeight: 700,
                background: s.pred === 1 ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                padding: '1px 6px', borderRadius: 4,
              }}>
                예측: {s.pred}
              </span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              정답: <span style={{
                fontWeight: 700,
                color: s.label === 1 ? '#ef4444' : '#3b82f6',
              }}>{s.label}</span>
              {s.correct
                ? <span style={{ color: C.emerald, marginLeft: 8 }}>→ 일치! 가중치를 그대로 둡니다</span>
                : <span style={{ color: C.rose, marginLeft: 8 }}>
                    → 불일치! 오차 = {s.label} - {s.pred} = <strong>{sign(s.error)}{s.error}</strong>
                    ({s.error > 0 ? '부족 → 더해야 함' : '과함 → 빼야 함'})
                  </span>
              }
            </div>
          </div>

          {/* 2. Weight update (only if wrong) */}
          {!s.correct && (
            <div>
              <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>가중치 업데이트</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 6,
              }}>
                {[
                  { name: 'w₁', before: s.w1Before, after: s.w1After, delta: s.dw1, calc: `${s.error}×${s.x1}` },
                  { name: 'w₂', before: s.w2Before, after: s.w2After, delta: s.dw2, calc: `${s.error}×${s.x2}` },
                  { name: 'b', before: s.bBefore, after: s.bAfter, delta: s.db, calc: `${s.error}` },
                ].map(({ name, before, after, delta, calc }) => (
                  <div key={name} style={{
                    padding: '8px 6px',
                    borderRadius: 10,
                    background: delta !== 0 ? 'rgba(15,23,42,0.6)' : 'rgba(15,23,42,0.3)',
                    border: `1px solid ${delta !== 0 ? 'rgba(99,102,241,0.2)' : C.borderLight}`,
                    textAlign: 'center',
                  }}>
                    <div style={{ color: C.dim, fontSize: 9, marginBottom: 3 }}>{name}</div>
                    {delta !== 0 ? (
                      <>
                        <div style={{ fontSize: 11, fontFamily: mono, color: C.muted, marginBottom: 2 }}>
                          {before} <span style={{ color: clr(delta) }}>{sign(delta)}{delta}</span>
                        </div>
                        <div style={{ fontSize: 9, fontFamily: mono, color: C.dim, marginBottom: 3 }}>
                          ({calc})
                        </div>
                        <div style={{
                          fontSize: 16, fontWeight: 700, fontFamily: mono,
                          color: name === 'b' ? C.pink : C.orange,
                        }}>
                          {after}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, fontFamily: mono, color: C.dim, marginBottom: 2 }}>
                          변화 없음
                        </div>
                        <div style={{ fontSize: 9, fontFamily: mono, color: C.dim, marginBottom: 3 }}>
                          ({calc} = 0)
                        </div>
                        <div style={{
                          fontSize: 16, fontWeight: 700, fontFamily: mono,
                          color: C.dim,
                        }}>
                          {after}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {/* Natural language + geometric intuition */}
              <div style={{
                marginTop: 8, padding: '8px 10px', borderRadius: 8,
                background: 'rgba(99,102,241,0.06)',
                fontSize: 12, color: C.muted, lineHeight: 1.7,
              }}>
                {s.error > 0
                  ? <>
                      <strong style={{ color: C.text }}>부족함</strong>: <span style={{ color: C.emerald }}>1</span>이어야 하는데 <span style={{ color: C.rose }}>0</span>으로 예측
                      → 입력값 ({s.x1}, {s.x2})을 가중치에 <strong style={{ color: C.emerald }}>더한다</strong>
                      <br />
                      <span style={{ color: C.dim, fontSize: 11 }}>
                        → 직선을 이 점이 1 영역에 들어오도록 밀어줍니다
                      </span>
                    </>
                  : <>
                      <strong style={{ color: C.text }}>과함</strong>: <span style={{ color: C.rose }}>0</span>이어야 하는데 <span style={{ color: C.emerald }}>1</span>로 예측
                      → 입력값 ({s.x1}, {s.x2})을 가중치에서 <strong style={{ color: C.rose }}>뺀다</strong>
                      <br />
                      <span style={{ color: C.dim, fontSize: 11 }}>
                        → 직선을 이 점이 0 영역에 들어오도록 밀어줍니다
                      </span>
                    </>
                }
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

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
          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <span style={{ color: '#a5b4fc', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>자동 학습</span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          {title || '퍼셉트론이 스스로 배우는 과정'}
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          {subtitle || '"틀리면 고치고, 맞으면 냅둔다" — 매 스텝의 가중치 변화를 지켜보세요'}
        </p>
      </div>

      {/* ─── Mode Tabs ─── */}
      {availModes.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
          {availModes.map((m) => {
            const active = mode === m;
            const isXor = m === 'XOR';
            return (
              <button
                key={m}
                onClick={() => switchMode(m)}
                disabled={running}
                style={{
                  padding: '9px 28px', borderRadius: 12,
                  border: active ? `2px solid ${isXor ? C.rose : C.violet}` : `1px solid ${C.borderLight}`,
                  background: active ? (isXor ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.12)') : 'rgba(30,41,59,0.4)',
                  color: active ? C.text : C.muted,
                  fontSize: 15, fontWeight: 700, fontFamily: mono,
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running && !active ? 0.4 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Controls row ─── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 500, margin: '0 auto 16px' }}>
        {!running ? (
          <button
            onClick={start}
            disabled={converged || (mode === 'XOR' && steps >= maxXorSteps)}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
              background: converged || (mode === 'XOR' && steps >= maxXorSteps)
                ? 'rgba(71,85,105,0.2)'
                : `linear-gradient(135deg, ${mode === 'XOR' ? '#ef4444' : '#6366f1'}, ${mode === 'XOR' ? '#dc2626' : '#8b5cf6'})`,
              color: converged || (mode === 'XOR' && steps >= maxXorSteps) ? C.dim : '#fff',
              fontSize: 14, fontWeight: 700,
              cursor: converged || (mode === 'XOR' && steps >= maxXorSteps) ? 'not-allowed' : 'pointer',
              boxShadow: converged ? 'none' : '0 4px 12px rgba(99,102,241,0.2)',
            }}
          >
            {steps === 0 ? '▶  학습 시작' : converged ? '✓  학습 완료' : '▶  계속'}
          </button>
        ) : (
          <button
            onClick={pause}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            ⏸  일시 정지
          </button>
        )}
        <button onClick={clearState} style={{
          padding: '11px 18px', borderRadius: 12,
          border: `1px solid ${C.borderLight}`, background: 'rgba(30,41,59,0.5)',
          color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          초기화
        </button>
        {/* Speed inline */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 12px', borderRadius: 12,
          border: `1px solid ${C.borderLight}`, background: 'rgba(30,41,59,0.5)',
        }}>
          <span style={{ color: C.dim, fontSize: 10, whiteSpace: 'nowrap' }}>속도</span>
          <input
            type="range" min="100" max="1200" step="50"
            value={1300 - speed}
            onChange={(e) => setSpeed(1300 - Number(e.target.value))}
            style={{ width: 60, accentColor: C.violet, cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* ─── Main Grid ─── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

        {/* ── Left: SVG + Stats ── */}
        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          {/* Status row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
            {[
              { label: '정확도', value: `${accuracy}/4`, color: accColor },
              { label: '에포크', value: `${epoch}`, color: C.text },
              { label: '스텝', value: `${steps}`, color: C.text },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                textAlign: 'center', padding: '8px 4px', borderRadius: 10,
                background: C.card, border: `1px solid ${C.borderLight}`,
              }}>
                <div style={{ color, fontSize: 20, fontWeight: 700, fontFamily: mono, lineHeight: 1 }}>{value}</div>
                <div style={{ color: C.dim, fontSize: 10, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Converged badge */}
          {converged && (
            <div style={{
              textAlign: 'center', padding: '8px', borderRadius: 10, marginBottom: 10,
              background: 'rgba(16,185,129,0.1)', border: `1.5px solid ${C.emerald}`,
            }}>
              <span style={{ color: C.emerald, fontSize: 13, fontWeight: 700 }}>
                학습 성공! 직선 하나로 모든 데이터를 나눌 수 있었습니다
              </span>
            </div>
          )}
          {/* XOR failed badge */}
          {mode === 'XOR' && steps >= maxXorSteps && !converged && (
            <div style={{
              textAlign: 'center', padding: '10px', borderRadius: 10, marginBottom: 10,
              background: 'rgba(239,68,68,0.08)', border: `1.5px solid ${C.rose}`,
            }}>
              <span style={{ color: C.pink, fontSize: 13, fontWeight: 700 }}>
                {maxXorSteps}스텝이 지나도 수렴하지 않습니다
              </span>
              <p style={{ color: C.muted, fontSize: 11, margin: '4px 0 0', lineHeight: 1.5 }}>
                직선이 계속 흔들립니다 — 빨간 점과 파란 점이 대각선으로 배치되어 있어서
                <strong style={{ color: C.pink }}>직선 하나로는 절대 나눌 수 없기 때문</strong>입니다.
                이 한계를 넘으려면 직선이 여러 개 필요합니다. (3차시에서 계속)
              </p>
            </div>
          )}

          {/* SVG Graph */}
          <div style={{
            borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${C.borderLight}`, background: 'rgba(8,12,24,0.8)',
          }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
              <defs>
                <linearGradient id="bGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={converged ? C.emerald : C.violet} />
                  <stop offset="100%" stopColor={converged ? '#34d399' : '#6366f1'} />
                </linearGradient>
                <filter id="gl"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>

              {/* Grid dots */}
              {[0, 0.25, 0.5, 0.75, 1].map(v =>
                [0, 0.25, 0.5, 0.75, 1].map(u =>
                  <circle key={`${v}-${u}`} cx={toSvg(u)} cy={toSvgY(v)} r="1.5" fill="#1e293b" />
                )
              )}

              {/* Axes */}
              <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#334155" strokeWidth="1" />
              <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#334155" strokeWidth="1" />
              <text x={W / 2} y={H - 8} textAnchor="middle" fill={C.dim} fontSize="11" fontFamily={mono}>x₁</text>
              <text x={10} y={H / 2} textAnchor="middle" fill={C.dim} fontSize="11" fontFamily={mono} transform={`rotate(-90,10,${H / 2})`}>x₂</text>
              {[0, 1].map(v => (
                <g key={v}>
                  <text x={toSvg(v)} y={H - PAD + 15} textAnchor="middle" fill={C.dim} fontSize="10">{v}</text>
                  <text x={PAD - 10} y={toSvgY(v) + 4} textAnchor="middle" fill={C.dim} fontSize="10">{v}</text>
                </g>
              ))}

              {/* Shaded region */}
              {boundary && (
                <polygon
                  points={`${toSvg(boundary.x1)},${toSvgY(boundary.y1)} ${toSvg(boundary.x2)},${toSvgY(boundary.y2)} ${W - PAD},${PAD} ${PAD},${PAD}`}
                  fill={converged ? 'rgba(16,185,129,0.05)' : 'rgba(139,92,246,0.04)'}
                />
              )}

              {/* Decision boundary */}
              {boundary && (
                <line
                  x1={toSvg(boundary.x1)} y1={toSvgY(boundary.y1)}
                  x2={toSvg(boundary.x2)} y2={toSvgY(boundary.y2)}
                  stroke="url(#bGrad)"
                  strokeWidth={converged ? 3.5 : 2.5}
                  strokeDasharray={converged ? 'none' : '6,4'}
                  opacity="0.9"
                  filter={converged ? 'url(#gl)' : undefined}
                  style={{ transition: 'all 0.3s ease' }}
                />
              )}

              {/* Data points */}
              {results.map((r, i) => {
                const cx = toSvg(r.x1), cy = toSvgY(r.x2);
                const isActive = i === activeIdx && (running || steps > 0);
                const color = r.label === 1 ? '#ef4444' : '#3b82f6';
                return (
                  <g key={i}>
                    {isActive && running && (
                      <circle cx={cx} cy={cy} r="24" fill="none" stroke="#fbbf24" strokeWidth="2.5" opacity="0.6">
                        <animate attributeName="r" values="20;26;20" dur="0.7s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="0.7s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle cx={cx} cy={cy} r="15" fill={color} opacity={0.9} style={{ transition: 'all 0.2s' }} />
                    <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily={mono}>
                      {r.label}
                    </text>
                    {steps > 0 && (
                      <text x={cx + 13} y={cy - 11} fill={r.correct ? C.emerald : C.rose} fontSize={r.correct ? '12' : '16'} fontWeight="900">
                        {r.correct ? '✓' : '✗'}
                      </text>
                    )}
                  </g>
                );
              })}

              {steps > 0 && (
                <g>
                  <rect x={W - PAD - 65} y={8} width={62} height={22} rx="6" fill="rgba(30,41,59,0.8)" stroke={C.borderLight} strokeWidth="1" />
                  <text x={W - PAD - 34} y={23} textAnchor="middle" fill={C.muted} fontSize="10" fontFamily={mono}>E{epoch} S{steps}</text>
                </g>
              )}
            </svg>
          </div>

          {/* Equation */}
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 10,
            background: C.card, border: `1px solid ${C.borderLight}`, textAlign: 'center',
          }}>
            <div style={{ color: C.dim, fontSize: 9, letterSpacing: '0.05em', fontWeight: 600, marginBottom: 2 }}>결정 경계</div>
            <code style={{ color: C.text, fontSize: 14, fontFamily: mono }}>
              <span style={{ color: C.orange }}>{w1.toFixed(1)}</span>
              <span style={{ color: C.dim }}>·x₁ + </span>
              <span style={{ color: C.orange }}>{w2.toFixed(1)}</span>
              <span style={{ color: C.dim }}>·x₂ + (</span>
              <span style={{ color: C.pink }}>{b.toFixed(1)}</span>
              <span style={{ color: C.dim }}>) = 0</span>
            </code>
          </div>

          {/* Compact history */}
          {history.length > 0 && (
            <div ref={histRef} style={{
              maxHeight: 120, overflowY: 'auto', marginTop: 8,
              borderRadius: 10, background: 'rgba(8,12,24,0.5)',
              border: `1px solid ${C.borderLight}`, padding: '4px 6px',
            }}>
              <div style={{ color: C.dim, fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', padding: '2px 4px' }}>히스토리</div>
              {history.map((e, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 4px', borderRadius: 4,
                  background: i === history.length - 1 ? 'rgba(99,102,241,0.06)' : 'transparent',
                  fontSize: 10, fontFamily: mono, color: e.correct ? C.dim : C.pink,
                }}>
                  <span style={{ width: 14, textAlign: 'right', color: C.dim }}>{e.epoch * 4 + e.idx + 1}</span>
                  <span>({e.x1},{e.x2})</span>
                  <span style={{ color: e.correct ? C.emerald : C.rose }}>{e.correct ? '✓' : '✗'}</span>
                  <span style={{ marginLeft: 'auto', color: C.dim }}>[{e.w1After},{e.w2After},{e.bAfter}]</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Explanation Panel ── */}
        <div style={{ flex: '1 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Weights display */}
          <div style={{
            padding: '12px 14px', borderRadius: 14,
            background: C.card, border: `1px solid ${C.borderLight}`,
          }}>
            <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>현재 가중치</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'w₁', val: w1, color: C.orange, delta: currentStep?.dw1 },
                { label: 'w₂', val: w2, color: C.orange, delta: currentStep?.dw2 },
                { label: 'b', val: b, color: C.pink, delta: currentStep?.db },
              ].map(({ label, val, color, delta }) => (
                <div key={label} style={{
                  flex: 1, textAlign: 'center',
                  padding: '8px 4px', borderRadius: 10,
                  background: 'rgba(15,23,42,0.5)',
                  border: `1px solid ${delta && delta !== 0 ? 'rgba(99,102,241,0.3)' : C.borderLight}`,
                  transition: 'border-color 0.3s',
                }}>
                  <div style={{
                    color, fontSize: 22, fontWeight: 700, fontFamily: mono,
                    transition: 'all 0.3s',
                  }}>{val.toFixed(1)}</div>
                  <div style={{ color: C.dim, fontSize: 10, marginTop: 2 }}>{label}</div>
                  {delta !== undefined && delta !== 0 && (
                    <div style={{
                      fontSize: 10, fontFamily: mono, marginTop: 2,
                      color: delta > 0 ? C.emerald : C.rose,
                    }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* THE KEY: Explanation panel */}
          <ExplanationPanel />

          {/* Pause hint */}
          {steps > 0 && !running && !converged && !(mode === 'XOR' && steps >= maxXorSteps) && (
            <div style={{
              textAlign: 'center', padding: '6px', borderRadius: 8,
              background: C.card, color: C.muted, fontSize: 11,
            }}>
              일시 정지 중 — "계속"을 눌러 학습을 이어가세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
