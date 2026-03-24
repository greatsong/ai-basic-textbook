import { useState, useMemo } from 'react';

// ─── Color constants (shared palette) ───
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
  pink: '#fca5a8',
  blue: '#3b82f6',
  cyan: '#22d3ee',
};

const mono = 'var(--sl-font-mono, monospace)';

// ─── Activation function colors ───
const FUNC_COLORS = {
  step: '#94a3b8',
  sigmoid: '#6366f1',
  tanh: '#f59e0b',
  relu: '#10b981',
};

// ─── Activation functions & derivatives ───
function stepFn(x: number): number {
  return x >= 0 ? 1 : 0;
}
function stepDeriv(_x: number): number {
  return 0; // 미분 불가능 (0에서 불연속)
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
function sigmoidDeriv(x: number): number {
  const s = sigmoid(x);
  return s * (1 - s);
}

function tanhFn(x: number): number {
  return Math.tanh(x);
}
function tanhDeriv(x: number): number {
  const t = Math.tanh(x);
  return 1 - t * t;
}

function relu(x: number): number {
  return Math.max(0, x);
}
function reluDeriv(x: number): number {
  return x > 0 ? 1 : 0;
}

interface FuncDef {
  key: string;
  name: string;
  nameKor: string;
  formula: string;
  color: string;
  fn: (x: number) => number;
  deriv: (x: number) => number;
  yMin: number;
  yMax: number;
  description: string;
}

const FUNCTIONS: FuncDef[] = [
  {
    key: 'step',
    name: 'Step',
    nameKor: '계단 함수',
    formula: 'f(x) = 0 (x<0), 1 (x≥0)',
    color: FUNC_COLORS.step,
    fn: stepFn,
    deriv: stepDeriv,
    yMin: -0.3,
    yMax: 1.5,
    description: '0 아니면 1. 미분 불가 → 학습 불가',
  },
  {
    key: 'sigmoid',
    name: 'Sigmoid',
    nameKor: '시그모이드',
    formula: 'f(x) = 1 / (1 + e⁻ˣ)',
    color: FUNC_COLORS.sigmoid,
    fn: sigmoid,
    deriv: sigmoidDeriv,
    yMin: -0.3,
    yMax: 1.5,
    description: '부드러운 S자. 미분 가능 → 학습 가능!',
  },
  {
    key: 'tanh',
    name: 'Tanh',
    nameKor: '하이퍼볼릭 탄젠트',
    formula: 'f(x) = tanh(x)',
    color: FUNC_COLORS.tanh,
    fn: tanhFn,
    deriv: tanhDeriv,
    yMin: -1.5,
    yMax: 1.5,
    description: '음수도 표현. Sigmoid보다 학습 안정적',
  },
  {
    key: 'relu',
    name: 'ReLU',
    nameKor: '렐루',
    formula: 'f(x) = max(0, x)',
    color: FUNC_COLORS.relu,
    fn: relu,
    deriv: reluDeriv,
    yMin: -1,
    yMax: 5.5,
    description: '양수 기울기=1. 깊은 층에서도 학습 가능',
  },
];

// ─── SVG Graph Component ───
const GRAPH_W = 260;
const GRAPH_H = 200;
const GRAPH_PAD = 32;

interface GraphProps {
  func: FuncDef;
  inputX: number;
}

function ActivationGraph({ func, inputX }: GraphProps) {
  const { fn, deriv, color, yMin, yMax } = func;

  const xMin = -5.5;
  const xMax = 5.5;

  const toSvgX = (x: number) =>
    GRAPH_PAD + ((x - xMin) / (xMax - xMin)) * (GRAPH_W - 2 * GRAPH_PAD);
  const toSvgY = (y: number) =>
    GRAPH_H - GRAPH_PAD - ((y - yMin) / (yMax - yMin)) * (GRAPH_H - 2 * GRAPH_PAD);

  // Generate curve points
  const curvePoints = useMemo(() => {
    const pts: string[] = [];
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (i / steps) * (xMax - xMin);
      let y = fn(x);
      // Clamp to visible area
      y = Math.max(yMin, Math.min(yMax, y));
      // For step function: draw vertical edge
      if (func.key === 'step' && i > 0) {
        const prevX = xMin + ((i - 1) / steps) * (xMax - xMin);
        if (prevX < 0 && x >= 0) {
          pts.push(`${toSvgX(0)},${toSvgY(0)}`);
          pts.push(`${toSvgX(0)},${toSvgY(1)}`);
        }
      }
      pts.push(`${toSvgX(x)},${toSvgY(y)}`);
    }
    return pts.join(' ');
  }, [fn, func.key, xMin, xMax, yMin, yMax]);

  const outputY = fn(inputX);
  const derivVal = deriv(inputX);
  const ptX = toSvgX(inputX);
  const ptY = toSvgY(Math.max(yMin, Math.min(yMax, outputY)));

  // Zero axes
  const zeroY = toSvgY(0);
  const zeroX = toSvgX(0);

  // Tangent line (short segment through the point)
  const tangentLen = 1.2;
  const tx1 = inputX - tangentLen;
  const ty1 = outputY - derivVal * tangentLen;
  const tx2 = inputX + tangentLen;
  const ty2 = outputY + derivVal * tangentLen;

  return (
    <svg
      viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
      width="100%"
      style={{ display: 'block' }}
    >
      {/* Background */}
      <rect
        x={GRAPH_PAD}
        y={GRAPH_PAD - 8}
        width={GRAPH_W - 2 * GRAPH_PAD}
        height={GRAPH_H - 2 * GRAPH_PAD + 16}
        rx={6}
        fill="rgba(15,23,42,0.5)"
      />

      {/* Grid lines */}
      {[-4, -2, 0, 2, 4].map((x) => (
        <line
          key={`gx${x}`}
          x1={toSvgX(x)}
          y1={GRAPH_PAD - 8}
          x2={toSvgX(x)}
          y2={GRAPH_H - GRAPH_PAD + 8}
          stroke="rgba(71,85,105,0.15)"
          strokeWidth={x === 0 ? 1 : 0.5}
        />
      ))}

      {/* Y-axis zero line */}
      <line
        x1={GRAPH_PAD}
        y1={zeroY}
        x2={GRAPH_W - GRAPH_PAD}
        y2={zeroY}
        stroke="rgba(71,85,105,0.3)"
        strokeWidth={1}
      />

      {/* X-axis zero line */}
      <line
        x1={zeroX}
        y1={GRAPH_PAD - 8}
        x2={zeroX}
        y2={GRAPH_H - GRAPH_PAD + 8}
        stroke="rgba(71,85,105,0.3)"
        strokeWidth={1}
      />

      {/* Axis labels */}
      {[-4, -2, 2, 4].map((x) => (
        <text
          key={`lx${x}`}
          x={toSvgX(x)}
          y={GRAPH_H - GRAPH_PAD + 20}
          textAnchor="middle"
          fill={C.dim}
          fontSize={8}
          fontFamily={mono}
        >
          {x}
        </text>
      ))}

      {/* Y-axis labels — different per function */}
      {func.key === 'tanh'
        ? [-1, 0, 1].map((y) => (
            <text
              key={`ly${y}`}
              x={GRAPH_PAD - 6}
              y={toSvgY(y) + 3}
              textAnchor="end"
              fill={C.dim}
              fontSize={8}
              fontFamily={mono}
            >
              {y}
            </text>
          ))
        : func.key === 'relu'
        ? [0, 1, 2, 3, 4, 5].map((y) => (
            <text
              key={`ly${y}`}
              x={GRAPH_PAD - 6}
              y={toSvgY(y) + 3}
              textAnchor="end"
              fill={C.dim}
              fontSize={8}
              fontFamily={mono}
            >
              {y}
            </text>
          ))
        : [0, 0.5, 1].map((y) => (
            <text
              key={`ly${y}`}
              x={GRAPH_PAD - 6}
              y={toSvgY(y) + 3}
              textAnchor="end"
              fill={C.dim}
              fontSize={8}
              fontFamily={mono}
            >
              {y}
            </text>
          ))}

      {/* Function curve */}
      <polyline
        points={curvePoints}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Tangent line at current point (skip for step function) */}
      {func.key !== 'step' && (
        <line
          x1={toSvgX(tx1)}
          y1={toSvgY(Math.max(yMin, Math.min(yMax, ty1)))}
          x2={toSvgX(tx2)}
          y2={toSvgY(Math.max(yMin, Math.min(yMax, ty2)))}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.5}
        />
      )}

      {/* Vertical guide line */}
      <line
        x1={ptX}
        y1={GRAPH_PAD - 8}
        x2={ptX}
        y2={GRAPH_H - GRAPH_PAD + 8}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      {/* Horizontal guide line to output */}
      <line
        x1={GRAPH_PAD}
        y1={ptY}
        x2={ptX}
        y2={ptY}
        stroke={color}
        strokeWidth={0.8}
        strokeDasharray="3 3"
        opacity={0.4}
      />

      {/* Current point */}
      <circle
        cx={ptX}
        cy={ptY}
        r={6}
        fill={color}
        stroke="white"
        strokeWidth={2}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />

      {/* Output value label near the point */}
      <text
        x={Math.min(ptX + 10, GRAPH_W - GRAPH_PAD - 5)}
        y={Math.max(ptY - 10, GRAPH_PAD + 5)}
        fill="white"
        fontSize={10}
        fontWeight={700}
        fontFamily={mono}
      >
        {outputY.toFixed(3)}
      </text>
    </svg>
  );
}

// ─── Main Component ───
export default function ActivationComparison() {
  const [inputX, setInputX] = useState(0);

  // Compute all outputs
  const outputs = useMemo(
    () =>
      FUNCTIONS.map((f) => ({
        ...f,
        output: f.fn(inputX),
        gradient: f.deriv(inputX),
      })),
    [inputX],
  );

  // Determine educational messages
  const sigmoidGrad = outputs[1].gradient;
  const isVanishing = Math.abs(inputX) >= 3;
  const reluGrad = outputs[3].gradient;

  return (
    <div
      style={{
        background: C.bg,
        borderRadius: 18,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: C.text,
        marginBottom: 24,
      }}
    >
      {/* ─── Header ─── */}
      <div
        style={{
          padding: '18px 22px 14px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #6366f1, #10b981)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            활성화함수 비교
          </span>
          <span
            style={{
              fontSize: 10,
              color: C.dim,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            인터랙티브
          </span>
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>
          슬라이더를 움직여 같은 입력에서 4가지 활성화함수의 출력과 기울기를 비교하세요
        </span>
      </div>

      {/* ─── Input Slider ─── */}
      <div
        style={{
          padding: '16px 22px 12px',
          borderBottom: `1px solid ${C.borderLight}`,
          background: 'rgba(30,41,59,0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, minWidth: 60 }}>
            입력값 x
          </span>
          <input
            type="range"
            min={-5}
            max={5}
            step={0.1}
            value={inputX}
            onChange={(e) => setInputX(parseFloat(e.target.value))}
            style={{
              flex: 1,
              height: 6,
              accentColor: C.violet,
              cursor: 'pointer',
            }}
          />
          <span
            style={{
              fontFamily: mono,
              fontSize: 18,
              fontWeight: 800,
              color: 'white',
              minWidth: 50,
              textAlign: 'right',
            }}
          >
            {inputX.toFixed(1)}
          </span>
        </div>
        {/* Quick-set buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[-5, -3, -1, 0, 1, 3, 5].map((v) => (
            <button
              key={v}
              onClick={() => setInputX(v)}
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                border: `1px solid ${inputX === v ? C.violet : C.borderLight}`,
                background: inputX === v ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: inputX === v ? C.violet : C.dim,
                fontSize: 11,
                fontFamily: mono,
                cursor: 'pointer',
                fontWeight: inputX === v ? 700 : 400,
              }}
            >
              {v > 0 ? `+${v}` : v}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 2x2 Graph Grid ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 0,
        }}
      >
        {FUNCTIONS.map((func, idx) => {
          const output = outputs[idx];
          return (
            <div
              key={func.key}
              style={{
                padding: '14px 14px 12px',
                borderRight: idx % 2 === 0 ? `1px solid ${C.borderLight}` : 'none',
                borderBottom: idx < 2 ? `1px solid ${C.borderLight}` : 'none',
              }}
            >
              {/* Function header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: func.color,
                    display: 'inline-block',
                    boxShadow: `0 0 6px ${func.color}`,
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: 14, color: func.color }}>
                  {func.name}
                </span>
                <span style={{ fontSize: 11, color: C.dim }}>{func.nameKor}</span>
              </div>

              {/* SVG Graph */}
              <ActivationGraph func={func} inputX={inputX} />

              {/* Formula */}
              <div
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  color: C.dim,
                  marginTop: 4,
                  marginBottom: 6,
                  textAlign: 'center',
                }}
              >
                {func.formula}
              </div>

              {/* Output & Gradient */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: 'rgba(15,23,42,0.5)',
                    border: `1px solid ${C.borderLight}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 9, color: C.dim, marginBottom: 2 }}>
                    출력값
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      fontFamily: mono,
                      color: func.color,
                    }}
                  >
                    {output.output.toFixed(3)}
                  </div>
                </div>
                <div
                  style={{
                    padding: '6px 8px',
                    borderRadius: 8,
                    background:
                      func.key !== 'step' && Math.abs(output.gradient) < 0.05
                        ? 'rgba(239,68,68,0.08)'
                        : 'rgba(15,23,42,0.5)',
                    border: `1px solid ${
                      func.key !== 'step' && Math.abs(output.gradient) < 0.05
                        ? 'rgba(239,68,68,0.2)'
                        : C.borderLight
                    }`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 9, color: C.dim, marginBottom: 2 }}>
                    기울기
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      fontFamily: mono,
                      color:
                        func.key === 'step'
                          ? C.dim
                          : Math.abs(output.gradient) < 0.05
                          ? C.rose
                          : C.text,
                    }}
                  >
                    {func.key === 'step' ? 'N/A' : output.gradient.toFixed(3)}
                  </div>
                </div>
              </div>

              {/* One-line description */}
              <div
                style={{
                  fontSize: 10,
                  color: C.muted,
                  marginTop: 6,
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}
              >
                {func.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Summary Comparison Card ─── */}
      <div
        style={{
          padding: '14px 22px',
          borderTop: `1px solid ${C.border}`,
          background: 'rgba(30,41,59,0.3)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.muted,
            marginBottom: 10,
            letterSpacing: '0.04em',
          }}
        >
          x = {inputX.toFixed(1)} 에서 4개 함수 비교
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}
        >
          {outputs.map((o) => (
            <div
              key={o.key}
              style={{
                padding: '8px 6px',
                borderRadius: 10,
                background: C.bg,
                border: `1px solid ${C.borderLight}`,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: o.color,
                  marginBottom: 4,
                }}
              >
                {o.name}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  fontFamily: mono,
                  color: 'white',
                  marginBottom: 2,
                }}
              >
                {o.output.toFixed(2)}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontFamily: mono,
                  color:
                    o.key === 'step'
                      ? C.dim
                      : Math.abs(o.gradient) < 0.05
                      ? C.rose
                      : C.muted,
                }}
              >
                {o.key === 'step' ? '미분불가' : `기울기 ${o.gradient.toFixed(3)}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Educational Messages ─── */}
      <div
        style={{
          padding: '12px 22px 16px',
          borderTop: `1px solid ${C.borderLight}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Step → Sigmoid transition insight */}
        {Math.abs(inputX) < 1.5 && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.2)',
              fontSize: 12,
              color: C.muted,
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: FUNC_COLORS.sigmoid, fontWeight: 700 }}>
              Step vs Sigmoid
            </span>{' '}
            — 딱딱한 계단을 부드러운 곡선으로 바꾸는 것. 이것만으로도 미분이
            가능해져서 학습할 수 있게 됩니다.
          </div>
        )}

        {/* Vanishing gradient warning */}
        {isVanishing && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 12,
              color: C.muted,
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: C.rose, fontWeight: 700 }}>
              기울기 소실!
            </span>{' '}
            Sigmoid 기울기 ={' '}
            <span style={{ fontFamily: mono, color: C.rose, fontWeight: 700 }}>
              {sigmoidGrad.toFixed(4)}
            </span>
            . 양 끝에서 기울기가 0에 가까워집니다. 층이 깊으면 뒤쪽 가중치가
            거의 안 바뀌는 이유입니다.
          </div>
        )}

        {/* ReLU advantage */}
        {inputX > 0.5 && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)',
              fontSize: 12,
              color: C.muted,
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: C.emerald, fontWeight: 700 }}>
              ReLU의 장점
            </span>{' '}
            — 양수 영역에서 기울기가 항상{' '}
            <span style={{ fontFamily: mono, color: C.emerald, fontWeight: 700 }}>
              {reluGrad.toFixed(0)}
            </span>
            . 기울기가 사라지지 않으므로 깊은 층에서도 학습 가능합니다. 이것이
            딥러닝의 열쇠가 된 이유입니다.
          </div>
        )}

        {/* ReLU dying neuron warning */}
        {inputX < -0.5 && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)',
              fontSize: 12,
              color: C.muted,
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: C.amber, fontWeight: 700 }}>
              ReLU의 약점
            </span>{' '}
            — 음수 입력이면 출력과 기울기가 모두 0. 이 뉴런은 학습 신호를 전혀
            받지 못합니다. 이것을{' '}
            <span style={{ fontWeight: 700, color: C.amber }}>Dying ReLU</span>{' '}
            문제라고 합니다.
          </div>
        )}

        {/* General insight at x=0 */}
        {inputX === 0 && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.15)',
              fontSize: 12,
              color: C.muted,
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: C.violet, fontWeight: 700 }}>x = 0</span> —
            모든 함수의 전환점입니다. Step은 여기서 불연속, Sigmoid는 0.5,
            Tanh는 0, ReLU는 꺾이는 점. 슬라이더를 양쪽으로 움직여 차이를
            느껴보세요.
          </div>
        )}
      </div>
    </div>
  );
}
