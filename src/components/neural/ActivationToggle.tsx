import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// ─── Types ───
type ActivationType = 'sigmoid' | 'relu';

interface DataPoint { x1: number; x2: number; label: number }

const XOR_DATA: DataPoint[] = [
  { x1: 0, x2: 0, label: 0 },
  { x1: 0, x2: 1, label: 1 },
  { x1: 1, x2: 0, label: 1 },
  { x1: 1, x2: 1, label: 0 },
];

// ─── Color constants (same as PerceptronLearning) ───
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

// ─── SVG layout ───
const W = 320;
const H = 280;
const PAD = 40;
const toSvgX = (v: number) => PAD + v * (W - 2 * PAD);
const toSvgY = (v: number) => H - PAD - v * (H - 2 * PAD);

// ─── Activation functions ───
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function sigmoidDeriv(a: number): number {
  return a * (1 - a);
}

function relu(x: number): number {
  return Math.max(0, x);
}

function reluDeriv(a: number): number {
  return a > 0 ? 1 : 0;
}

// ─── 2-layer network: input(2) -> hidden(2) -> output(1) ───
interface Weights {
  // Hidden layer: 2 inputs -> 2 hidden neurons
  w1: number[][]; // [2][2]: w1[h][i] = weight from input i to hidden h
  b1: number[];   // [2]: bias for each hidden neuron
  // Output layer: 2 hidden -> 1 output
  w2: number[];   // [2]: weight from hidden h to output
  b2: number;     // bias for output
}

function initWeights(): Weights {
  const r = () => (Math.random() - 0.5) * 2;
  return {
    w1: [[r(), r()], [r(), r()]],
    b1: [r(), r()],
    w2: [r(), r()],
    b2: r(),
  };
}

function forward(
  w: Weights,
  x1: number,
  x2: number,
  activationOn: boolean,
  activationType: ActivationType,
) {
  const act = activationOn
    ? (activationType === 'sigmoid' ? sigmoid : relu)
    : (x: number) => x; // identity

  // Hidden layer
  const zH = [
    w.w1[0][0] * x1 + w.w1[0][1] * x2 + w.b1[0],
    w.w1[1][0] * x1 + w.w1[1][1] * x2 + w.b1[1],
  ];
  const aH = [act(zH[0]), act(zH[1])];

  // Output layer (always sigmoid for classification)
  const zO = w.w2[0] * aH[0] + w.w2[1] * aH[1] + w.b2;
  const aO = sigmoid(zO);

  return { zH, aH, zO, aO };
}

function trainStep(
  w: Weights,
  data: DataPoint[],
  activationOn: boolean,
  activationType: ActivationType,
  lr: number,
): { loss: number; correct: number } {
  const act = activationOn
    ? (activationType === 'sigmoid' ? sigmoid : relu)
    : (x: number) => x;
  const actDeriv = activationOn
    ? (activationType === 'sigmoid' ? sigmoidDeriv : reluDeriv)
    : (_a: number) => 1; // identity derivative

  let totalLoss = 0;
  let correctCount = 0;

  // Accumulate gradients over all 4 data points
  const dw1 = [[0, 0], [0, 0]];
  const db1 = [0, 0];
  const dw2 = [0, 0];
  let db2 = 0;

  for (const p of data) {
    const x = [p.x1, p.x2];

    // Forward
    const zH = [
      w.w1[0][0] * x[0] + w.w1[0][1] * x[1] + w.b1[0],
      w.w1[1][0] * x[0] + w.w1[1][1] * x[1] + w.b1[1],
    ];
    const aH = [act(zH[0]), act(zH[1])];
    const zO = w.w2[0] * aH[0] + w.w2[1] * aH[1] + w.b2;
    const aO = sigmoid(zO);

    // Loss (BCE)
    const eps = 1e-7;
    const clamped = Math.max(eps, Math.min(1 - eps, aO));
    totalLoss += -(p.label * Math.log(clamped) + (1 - p.label) * Math.log(1 - clamped));

    const pred = aO >= 0.5 ? 1 : 0;
    if (pred === p.label) correctCount++;

    // Backprop
    const dLdaO = aO - p.label; // derivative of BCE w.r.t. aO (sigmoid output)

    // Output layer gradients
    for (let h = 0; h < 2; h++) {
      dw2[h] += dLdaO * aH[h];
    }
    db2 += dLdaO;

    // Hidden layer gradients
    for (let h = 0; h < 2; h++) {
      const dLdaH = dLdaO * w.w2[h];
      const dLdzH = dLdaH * actDeriv(aH[h]);
      for (let i = 0; i < 2; i++) {
        dw1[h][i] += dLdzH * x[i];
      }
      db1[h] += dLdzH;
    }
  }

  // Update weights (average gradients over batch)
  const n = data.length;
  for (let h = 0; h < 2; h++) {
    for (let i = 0; i < 2; i++) {
      w.w1[h][i] -= lr * dw1[h][i] / n;
    }
    w.b1[h] -= lr * db1[h] / n;
    w.w2[h] -= lr * dw2[h] / n;
  }
  w.b2 -= lr * db2 / n;

  return { loss: totalLoss / n, correct: correctCount };
}

// ─── Decision boundary grid ───
const GRID_RES = 30;
function computeGrid(
  w: Weights,
  activationOn: boolean,
  activationType: ActivationType,
): number[][] {
  const grid: number[][] = [];
  for (let j = 0; j <= GRID_RES; j++) {
    const row: number[] = [];
    for (let i = 0; i <= GRID_RES; i++) {
      const x1 = i / GRID_RES;
      const x2 = j / GRID_RES;
      const { aO } = forward(w, x1, x2, activationOn, activationType);
      row.push(aO);
    }
    grid.push(row);
  }
  return grid;
}

// ─── Props ───
interface Props {
  /** 초기 활성화함수 ON/OFF 상태 */
  initialActivation?: boolean;
  /** 제목 */
  title?: string;
  /** 설명 */
  subtitle?: string;
}

export default function ActivationToggle({
  initialActivation = false,
  title,
  subtitle,
}: Props) {
  const [activationOn, setActivationOn] = useState(initialActivation);
  const [activationType, setActivationType] = useState<ActivationType>('sigmoid');
  const [running, setRunning] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [loss, setLoss] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState(0);
  const [speed, setSpeed] = useState(500);
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [trained, setTrained] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [failedOff, setFailedOff] = useState(false);

  const weightsRef = useRef<Weights>(initWeights());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const epochRef = useRef(0);
  const stableCount = useRef(0);

  const lr = activationType === 'relu' ? 0.5 : 1.0;
  const maxEpochs = 2000;

  // Classify current data points
  const results = useMemo(() => {
    if (!trained && epoch === 0) {
      return XOR_DATA.map(p => ({ ...p, pred: 0, yhat: 0.5, correct: false }));
    }
    return XOR_DATA.map(p => {
      const { aO } = forward(weightsRef.current, p.x1, p.x2, activationOn, activationType);
      const pred = aO >= 0.5 ? 1 : 0;
      return { ...p, pred, yhat: aO, correct: pred === p.label };
    });
  }, [epoch, activationOn, activationType, trained]);

  // Single epoch
  const doEpoch = useCallback(() => {
    const w = weightsRef.current;
    const { loss: l, correct } = trainStep(w, XOR_DATA, activationOn, activationType, lr);

    epochRef.current++;
    setEpoch(epochRef.current);
    setLoss(l);
    setAccuracy(correct);

    // Compute grid every 10 epochs for performance
    if (epochRef.current % 5 === 0 || epochRef.current <= 3) {
      setGrid(computeGrid(w, activationOn, activationType));
    }

    // Check success (4/4 correct for 20 consecutive epochs)
    if (correct === 4) {
      stableCount.current++;
      if (stableCount.current >= 20) {
        setSucceeded(true);
        setRunning(false);
        setGrid(computeGrid(w, activationOn, activationType));
        return;
      }
    } else {
      stableCount.current = 0;
    }

    // Check max epochs (failure for OFF mode)
    if (epochRef.current >= maxEpochs) {
      if (!activationOn) setFailedOff(true);
      setRunning(false);
      setGrid(computeGrid(w, activationOn, activationType));
      return;
    }

    timerRef.current = setTimeout(doEpoch, speed);
  }, [activationOn, activationType, lr, speed, maxEpochs]);

  const start = useCallback(() => {
    if (succeeded) return;
    setRunning(true);
    setTrained(true);
    timerRef.current = setTimeout(doEpoch, 100);
  }, [doEpoch, succeeded]);

  const pause = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    weightsRef.current = initWeights();
    epochRef.current = 0;
    stableCount.current = 0;
    setRunning(false);
    setEpoch(0);
    setLoss(null);
    setAccuracy(0);
    setGrid(null);
    setTrained(false);
    setSucceeded(false);
    setFailedOff(false);
  }, []);

  // Speed change while running
  useEffect(() => {
    if (running) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doEpoch, speed);
    }
  }, [speed]);

  // Cleanup
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Toggle activation: reset training
  const toggleActivation = useCallback((on: boolean) => {
    if (running) return;
    reset();
    setActivationOn(on);
  }, [running, reset]);

  const switchActivationType = useCallback((t: ActivationType) => {
    if (running) return;
    reset();
    setActivationType(t);
  }, [running, reset]);

  const accColor = accuracy === 4 ? C.emerald : accuracy >= 2 ? C.amber : C.rose;

  // ─── SVG Decision boundary heatmap ───
  const GridHeatmap = () => {
    if (!grid) return null;
    const cellW = (W - 2 * PAD) / GRID_RES;
    const cellH = (H - 2 * PAD) / GRID_RES;
    const rects: JSX.Element[] = [];

    for (let j = 0; j <= GRID_RES; j++) {
      for (let i = 0; i <= GRID_RES; i++) {
        const val = grid[j][i];
        // Blue (class 0) to Red (class 1) gradient
        const r = Math.round(val * 239 + (1 - val) * 59);
        const g = Math.round(val * 68 + (1 - val) * 130);
        const b = Math.round(val * 68 + (1 - val) * 246);
        rects.push(
          <rect
            key={`${i}-${j}`}
            x={toSvgX(i / GRID_RES) - cellW / 2}
            y={toSvgY(j / GRID_RES) - cellH / 2}
            width={cellW}
            height={cellH}
            fill={`rgba(${r},${g},${b},0.25)`}
          />
        );
      }
    }
    return <>{rects}</>;
  };

  // ─── Network diagram (small) ───
  const NetworkDiagram = () => {
    const nW = 160;
    const nH = 100;
    const layers = [
      { x: 20, nodes: [30, 70], labels: ['x₁', 'x₂'] },
      { x: 80, nodes: [30, 70], labels: ['h₁', 'h₂'] },
      { x: 140, nodes: [50], labels: ['y'] },
    ];

    return (
      <svg viewBox={`0 0 ${nW} ${nH}`} style={{ width: '100%', maxWidth: 200, display: 'block', margin: '0 auto' }}>
        {/* Connections */}
        {layers.slice(0, -1).map((layer, li) =>
          layer.nodes.map((fromY, fi) =>
            layers[li + 1].nodes.map((toY, ti) => (
              <line
                key={`${li}-${fi}-${ti}`}
                x1={layer.x} y1={fromY}
                x2={layers[li + 1].x} y2={toY}
                stroke={C.dim} strokeWidth="1" opacity="0.5"
              />
            ))
          )
        )}
        {/* Activation label between hidden and output */}
        {activationOn && (
          <g>
            <rect x={45} y={42} width={30} height={16} rx={4}
              fill={activationType === 'sigmoid' ? 'rgba(139,92,246,0.2)' : 'rgba(34,211,238,0.2)'}
              stroke={activationType === 'sigmoid' ? C.violet : C.cyan}
              strokeWidth="1"
            />
            <text x={60} y={53} textAnchor="middle"
              fill={activationType === 'sigmoid' ? C.violet : C.cyan}
              fontSize="7" fontWeight="700" fontFamily={mono}
            >
              {activationType === 'sigmoid' ? 'sig' : 'relu'}
            </text>
          </g>
        )}
        {/* Nodes */}
        {layers.map((layer, li) =>
          layer.nodes.map((ny, ni) => (
            <g key={`n${li}-${ni}`}>
              <circle cx={layer.x} cy={ny} r={10}
                fill={li === 0 ? 'rgba(59,130,246,0.15)' : li === 2 ? 'rgba(139,92,246,0.15)' : (activationOn ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)')}
                stroke={li === 0 ? C.blue : li === 2 ? C.violet : (activationOn ? C.emerald : C.dim)}
                strokeWidth="1.5"
              />
              <text x={layer.x} y={ny + 3.5} textAnchor="middle"
                fill={li === 0 ? C.blue : li === 2 ? C.violet : (activationOn ? C.emerald : C.muted)}
                fontSize="8" fontWeight="600" fontFamily={mono}
              >
                {layer.labels[ni]}
              </text>
            </g>
          ))
        )}
      </svg>
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
          <span style={{ fontSize: 14 }}>🔀</span>
          <span style={{ color: '#a5b4fc', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>2층 신경망</span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          {title || '활성화함수 ON/OFF 실험'}
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          {subtitle || '"스위치 하나로 결과가 완전히 달라집니다" — 같은 2층 신경망으로 XOR을 학습해보세요'}
        </p>
      </div>

      {/* ─── Activation Toggle Switch ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 16, marginBottom: 16,
        padding: '14px 20px', borderRadius: 14,
        background: activationOn
          ? 'rgba(16,185,129,0.06)'
          : 'rgba(239,68,68,0.04)',
        border: `1px solid ${activationOn ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)'}`,
        transition: 'all 0.3s',
      }}>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: !activationOn ? C.rose : C.dim,
        }}>
          OFF
        </span>
        <button
          onClick={() => toggleActivation(!activationOn)}
          disabled={running}
          aria-label="활성화함수 ON/OFF 토글"
          style={{
            position: 'relative',
            width: 56, height: 28,
            borderRadius: 14,
            border: 'none',
            background: activationOn
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, #475569, #334155)',
            cursor: running ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s',
            opacity: running ? 0.6 : 1,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 3, left: activationOn ? 31 : 3,
            width: 22, height: 22,
            borderRadius: 11,
            background: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            transition: 'left 0.3s',
          }} />
        </button>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: activationOn ? C.emerald : C.dim,
        }}>
          ON
        </span>

        {/* Activation type selector (only when ON) */}
        {activationOn && (
          <div style={{
            display: 'flex', gap: 4, marginLeft: 8,
            padding: '3px', borderRadius: 10,
            background: 'rgba(15,23,42,0.5)',
            border: `1px solid ${C.borderLight}`,
          }}>
            {(['sigmoid', 'relu'] as ActivationType[]).map(t => (
              <button
                key={t}
                onClick={() => switchActivationType(t)}
                disabled={running}
                style={{
                  padding: '4px 12px', borderRadius: 8,
                  border: 'none',
                  background: activationType === t
                    ? (t === 'sigmoid' ? 'rgba(139,92,246,0.2)' : 'rgba(34,211,238,0.2)')
                    : 'transparent',
                  color: activationType === t
                    ? (t === 'sigmoid' ? C.violet : C.cyan)
                    : C.dim,
                  fontSize: 12, fontWeight: 600, fontFamily: mono,
                  cursor: running ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {t === 'sigmoid' ? 'Sigmoid' : 'ReLU'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Status label ─── */}
      <div style={{
        textAlign: 'center', marginBottom: 14,
        padding: '6px 14px', borderRadius: 8,
        background: 'rgba(15,23,42,0.5)',
      }}>
        <span style={{ fontSize: 12, color: C.muted }}>
          {activationOn
            ? <>활성화함수: <strong style={{ color: activationType === 'sigmoid' ? C.violet : C.cyan }}>{activationType === 'sigmoid' ? 'Sigmoid' : 'ReLU'}</strong> — 각 은닉 뉴런의 출력을 비선형으로 변환합니다</>
            : <>활성화함수: <strong style={{ color: C.rose }}>없음 (Identity)</strong> — 입력을 그대로 통과시킵니다</>
          }
        </span>
      </div>

      {/* ─── Controls row ─── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 520, margin: '0 auto 16px' }}>
        {!running ? (
          <button
            onClick={start}
            disabled={succeeded || (failedOff && !activationOn)}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
              background: succeeded || (failedOff && !activationOn)
                ? 'rgba(71,85,105,0.2)'
                : activationOn
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: succeeded || (failedOff && !activationOn) ? C.dim : '#fff',
              fontSize: 14, fontWeight: 700,
              cursor: succeeded || (failedOff && !activationOn) ? 'not-allowed' : 'pointer',
              boxShadow: succeeded ? 'none' : '0 4px 12px rgba(99,102,241,0.2)',
            }}
          >
            {epoch === 0 ? '▶  학습 시작' : succeeded ? '✓  학습 완료' : '▶  계속'}
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
        <button onClick={reset} style={{
          padding: '11px 18px', borderRadius: 12,
          border: `1px solid ${C.borderLight}`, background: 'rgba(30,41,59,0.5)',
          color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          초기화
        </button>
        {/* Speed slider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 12px', borderRadius: 12,
          border: `1px solid ${C.borderLight}`, background: 'rgba(30,41,59,0.5)',
        }}>
          <span style={{ color: C.dim, fontSize: 10, whiteSpace: 'nowrap' }}>속도</span>
          <input
            type="range" min="50" max="1000" step="50"
            value={1050 - speed}
            onChange={(e) => setSpeed(1050 - Number(e.target.value))}
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
              { label: '정확도', value: `${accuracy}/4`, color: accuracy > 0 ? accColor : C.text },
              { label: '에포크', value: `${epoch}`, color: C.text },
              { label: '손실(Loss)', value: loss !== null ? loss.toFixed(3) : '—', color: loss !== null && loss < 0.1 ? C.emerald : C.text },
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

          {/* Success badge */}
          {succeeded && (
            <div style={{
              textAlign: 'center', padding: '10px', borderRadius: 10, marginBottom: 10,
              background: 'rgba(16,185,129,0.1)', border: `1.5px solid ${C.emerald}`,
            }}>
              <span style={{ color: C.emerald, fontSize: 13, fontWeight: 700 }}>
                XOR 분류 성공!
              </span>
              <p style={{ color: C.muted, fontSize: 11, margin: '4px 0 0', lineHeight: 1.6 }}>
                활성화함수가 공간을 구부려서 XOR을 나눌 수 있게 되었습니다.
                <br />
                <span style={{ color: C.dim }}>
                  직선만으로는 불가능했던 대각선 분류를, 비선형 변환이 가능하게 만들었습니다.
                </span>
              </p>
            </div>
          )}

          {/* Failure badge (activation OFF) */}
          {failedOff && !activationOn && (
            <div style={{
              textAlign: 'center', padding: '10px', borderRadius: 10, marginBottom: 10,
              background: 'rgba(239,68,68,0.08)', border: `1.5px solid ${C.rose}`,
            }}>
              <span style={{ color: C.pink, fontSize: 13, fontWeight: 700 }}>
                {maxEpochs}에포크가 지나도 XOR을 풀지 못합니다
              </span>
              <p style={{ color: C.muted, fontSize: 11, margin: '4px 0 0', lineHeight: 1.6 }}>
                활성화함수 없이는 층을 쌓아도 직선 하나와 같습니다.
                <br />
                <span style={{ color: C.dim }}>
                  2층의 계산: z = w₂(w₁x + b₁) + b₂ = Wx + B — 결국 직선 하나입니다.
                  <br />
                  위의 <strong style={{ color: C.emerald }}>스위치를 켜고</strong> 다시 시도해보세요!
                </span>
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
                <linearGradient id="atBGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={succeeded ? C.emerald : (activationOn ? C.violet : C.rose)} />
                  <stop offset="100%" stopColor={succeeded ? '#34d399' : (activationOn ? '#6366f1' : '#f87171')} />
                </linearGradient>
              </defs>

              {/* Grid dots */}
              {[0, 0.25, 0.5, 0.75, 1].map(v =>
                [0, 0.25, 0.5, 0.75, 1].map(u =>
                  <circle key={`${v}-${u}`} cx={toSvgX(u)} cy={toSvgY(v)} r="1.5" fill="#1e293b" />
                )
              )}

              {/* Axes */}
              <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#334155" strokeWidth="1" />
              <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#334155" strokeWidth="1" />
              <text x={W / 2} y={H - 8} textAnchor="middle" fill={C.dim} fontSize="11" fontFamily={mono}>x₁</text>
              <text x={10} y={H / 2} textAnchor="middle" fill={C.dim} fontSize="11" fontFamily={mono} transform={`rotate(-90,10,${H / 2})`}>x₂</text>
              {[0, 1].map(v => (
                <g key={v}>
                  <text x={toSvgX(v)} y={H - PAD + 15} textAnchor="middle" fill={C.dim} fontSize="10">{v}</text>
                  <text x={PAD - 10} y={toSvgY(v) + 4} textAnchor="middle" fill={C.dim} fontSize="10">{v}</text>
                </g>
              ))}

              {/* Decision boundary heatmap */}
              <GridHeatmap />

              {/* Decision boundary contour at 0.5 threshold */}
              {grid && (() => {
                // Draw contour line where output crosses 0.5
                const segments: JSX.Element[] = [];
                let segIdx = 0;
                for (let j = 0; j < GRID_RES; j++) {
                  for (let i = 0; i < GRID_RES; i++) {
                    const vals = [
                      grid[j][i], grid[j][i + 1],
                      grid[j + 1][i + 1], grid[j + 1][i],
                    ];
                    // Check if 0.5 contour crosses this cell
                    for (let e = 0; e < 4; e++) {
                      const e2 = (e + 1) % 4;
                      if ((vals[e] - 0.5) * (vals[e2] - 0.5) < 0) {
                        // Find crossing point on this edge
                        const t1 = (0.5 - vals[e]) / (vals[e2] - vals[e]);
                        // Check next edges for another crossing
                        for (let f = e + 1; f < 4; f++) {
                          const f2 = (f + 1) % 4;
                          if ((vals[f] - 0.5) * (vals[f2] - 0.5) < 0) {
                            const t2 = (0.5 - vals[f]) / (vals[f2] - vals[f]);
                            // Get coordinates
                            const corners = [
                              [i / GRID_RES, j / GRID_RES],
                              [(i + 1) / GRID_RES, j / GRID_RES],
                              [(i + 1) / GRID_RES, (j + 1) / GRID_RES],
                              [i / GRID_RES, (j + 1) / GRID_RES],
                            ];
                            const x1 = corners[e][0] + t1 * (corners[e2][0] - corners[e][0]);
                            const y1 = corners[e][1] + t1 * (corners[e2][1] - corners[e][1]);
                            const x2 = corners[f][0] + t2 * (corners[f2][0] - corners[f][0]);
                            const y2 = corners[f][1] + t2 * (corners[f2][1] - corners[f][1]);
                            segments.push(
                              <line
                                key={`seg-${segIdx++}`}
                                x1={toSvgX(x1)} y1={toSvgY(y1)}
                                x2={toSvgX(x2)} y2={toSvgY(y2)}
                                stroke="url(#atBGrad)"
                                strokeWidth={succeeded ? 3 : 2}
                                opacity="0.9"
                              />
                            );
                            break;
                          }
                        }
                        break;
                      }
                    }
                  }
                }
                return <>{segments}</>;
              })()}

              {/* Data points */}
              {results.map((r, i) => {
                const cx = toSvgX(r.x1), cy = toSvgY(r.x2);
                const color = r.label === 1 ? '#ef4444' : '#3b82f6';
                return (
                  <g key={i}>
                    {running && (
                      <circle cx={cx} cy={cy} r="22" fill="none" stroke={color} strokeWidth="1.5" opacity="0.3">
                        <animate attributeName="r" values="18;24;18" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle cx={cx} cy={cy} r="15" fill={color} opacity={0.9} style={{ transition: 'all 0.2s' }} />
                    <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily={mono}>
                      {r.label}
                    </text>
                    {trained && epoch > 0 && (
                      <text x={cx + 13} y={cy - 11}
                        fill={r.correct ? C.emerald : C.rose}
                        fontSize={r.correct ? '12' : '16'} fontWeight="900"
                      >
                        {r.correct ? '✓' : '✗'}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Epoch counter in SVG */}
              {epoch > 0 && (
                <g>
                  <rect x={W - PAD - 70} y={8} width={68} height={22} rx="6" fill="rgba(30,41,59,0.8)" stroke={C.borderLight} strokeWidth="1" />
                  <text x={W - PAD - 36} y={23} textAnchor="middle" fill={C.muted} fontSize="10" fontFamily={mono}>E{epoch}</text>
                </g>
              )}
            </svg>
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8,
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(15,23,42,0.5)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: '#ef4444', display: 'inline-block' }} />
              레이블 1
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: '#3b82f6', display: 'inline-block' }} />
              레이블 0
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted }}>
              <span style={{ width: 16, height: 2, background: activationOn ? C.violet : C.rose, display: 'inline-block', borderRadius: 1 }} />
              결정 경계
            </span>
          </div>
        </div>

        {/* ── Right: Network + Explanation ── */}
        <div style={{ flex: '1 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Network architecture diagram */}
          <div style={{
            padding: '12px 14px', borderRadius: 14,
            background: C.card, border: `1px solid ${C.borderLight}`,
          }}>
            <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>네트워크 구조</div>
            <NetworkDiagram />
            <div style={{ textAlign: 'center', fontSize: 10, color: C.dim, marginTop: 4, fontFamily: mono }}>
              입력(2) → 은닉(2) → 출력(1) | 파라미터 9개
            </div>
          </div>

          {/* Explanation panel */}
          {!trained ? (
            <div style={{
              padding: '16px', borderRadius: 14,
              background: 'rgba(99,102,241,0.06)',
              border: `1px dashed rgba(99,102,241,0.3)`,
              textAlign: 'center',
            }}>
              <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.7 }}>
                "학습 시작"을 누르면 2층 신경망이
                <br />XOR 데이터를 학습하는 과정을 볼 수 있습니다
              </p>
              <p style={{ color: C.dim, fontSize: 11, margin: '8px 0 0', lineHeight: 1.6 }}>
                {activationOn
                  ? '활성화함수가 켜져 있습니다 — 공간을 구부릴 수 있습니다'
                  : '활성화함수가 꺼져 있습니다 — 구부리기 불가능합니다'
                }
              </p>
            </div>
          ) : (
            <div style={{
              borderRadius: 14,
              background: succeeded
                ? 'rgba(16,185,129,0.06)'
                : failedOff
                  ? 'rgba(239,68,68,0.06)'
                  : 'rgba(99,102,241,0.04)',
              border: `1px solid ${succeeded ? 'rgba(16,185,129,0.2)' : failedOff ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.15)'}`,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px',
                background: succeeded
                  ? 'rgba(16,185,129,0.08)'
                  : failedOff
                    ? 'rgba(239,68,68,0.08)'
                    : 'rgba(99,102,241,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: succeeded ? C.emerald : failedOff ? C.rose : C.muted,
                }}>
                  {succeeded
                    ? '✓ 학습 성공!'
                    : failedOff
                      ? '✗ 학습 실패'
                      : `학습 중... (${accuracy}/4 정확)`
                  }
                </span>
                <span style={{ fontSize: 10, color: C.dim, fontFamily: mono }}>
                  에포크 {epoch}
                </span>
              </div>

              <div style={{ padding: '12px 14px' }}>
                {/* What's happening */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>무슨 일이 일어나고 있나?</div>
                  {activationOn ? (
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: C.blue }}>입력</span>
                        <span style={{ color: C.dim }}> → </span>
                        <span style={{ color: C.orange }}>가중합</span>
                        <span style={{ color: C.dim }}> → </span>
                        <span style={{ color: activationType === 'sigmoid' ? C.violet : C.cyan, fontWeight: 700 }}>
                          {activationType === 'sigmoid' ? 'sigmoid()' : 'relu()'}
                        </span>
                        <span style={{ color: C.dim }}> → </span>
                        <span style={{ color: C.emerald }}>비선형 출력</span>
                      </div>
                      <div style={{
                        padding: '6px 10px', borderRadius: 6,
                        background: 'rgba(15,23,42,0.4)',
                        fontSize: 11, color: C.dim, lineHeight: 1.6,
                      }}>
                        각 은닉 뉴런이 입력 공간에 직선을 긋고,
                        활성화함수가 그 결과를 <strong style={{ color: activationType === 'sigmoid' ? C.violet : C.cyan }}>구부립니다</strong>.
                        출력 뉴런은 구부러진 결과를 조합하여 XOR 패턴을 분류합니다.
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ color: C.blue }}>입력</span>
                        <span style={{ color: C.dim }}> → </span>
                        <span style={{ color: C.orange }}>가중합</span>
                        <span style={{ color: C.dim }}> → </span>
                        <span style={{ color: C.rose, fontWeight: 700 }}>그대로 통과</span>
                        <span style={{ color: C.dim }}> → </span>
                        <span style={{ color: C.orange }}>가중합</span>
                      </div>
                      <div style={{
                        padding: '6px 10px', borderRadius: 6,
                        background: 'rgba(15,23,42,0.4)',
                        fontSize: 11, color: C.dim, lineHeight: 1.6,
                      }}>
                        활성화함수가 없으면 곱하기와 더하기만 반복됩니다.
                        <br />
                        <span style={{ fontFamily: mono, fontSize: 10 }}>
                          z = W₂(W₁x + b₁) + b₂ = <strong style={{ color: C.rose }}>Wx + B</strong>
                        </span>
                        <br />
                        결국 <strong style={{ color: C.rose }}>직선 하나</strong>와 같아서 XOR을 나눌 수 없습니다.
                      </div>
                    </div>
                  )}
                </div>

                {/* Data table */}
                <div>
                  <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 6 }}>데이터 분류 현황</div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
                  }}>
                    {results.map((r, i) => (
                      <div key={i} style={{
                        textAlign: 'center', padding: '6px 4px', borderRadius: 8,
                        background: r.correct ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${r.correct ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        <div style={{ fontSize: 10, fontFamily: mono, color: C.muted }}>
                          ({r.x1},{r.x2})
                        </div>
                        <div style={{
                          fontSize: 14, fontWeight: 700, fontFamily: mono,
                          color: r.correct ? C.emerald : C.rose,
                        }}>
                          {r.correct ? '✓' : '✗'}
                        </div>
                        <div style={{ fontSize: 9, fontFamily: mono, color: C.dim }}>
                          {epoch > 0 ? `${(r.yhat * 100).toFixed(0)}%` : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key insight */}
                {(succeeded || failedOff) && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 8,
                    background: succeeded ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${succeeded ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)'}`,
                    fontSize: 12, lineHeight: 1.7,
                  }}>
                    <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 4 }}>핵심 통찰</div>
                    {succeeded ? (
                      <div style={{ color: C.muted }}>
                        <strong style={{ color: C.emerald }}>비선형 활성화함수</strong>가 각 층의 출력을 구부려서,
                        2층 신경망이 직선 2개를 <strong style={{ color: C.text }}>독립적으로</strong> 사용할 수 있게 되었습니다.
                        이것이 <strong style={{ color: C.text }}>비선형성(Non-linearity)</strong>의 위력입니다.
                      </div>
                    ) : (
                      <div style={{ color: C.muted }}>
                        <strong style={{ color: C.rose }}>활성화함수 없이</strong> 층을 아무리 쌓아도,
                        전체 네트워크는 <strong style={{ color: C.text }}>직선 하나</strong>와 수학적으로 동일합니다.
                        10층을 쌓아도, 100층을 쌓아도 마찬가지입니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pause hint */}
          {trained && !running && !succeeded && !failedOff && epoch > 0 && (
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
