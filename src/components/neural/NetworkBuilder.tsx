import { useState, useRef, useMemo, useCallback, useEffect } from 'react';

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
  blue: '#3b82f6',
  cyan: '#22d3ee',
};
const mono = 'var(--sl-font-mono, monospace)';

// ─── Types ───
interface Layer { w: number[][]; b: number[] }
interface Weights { layers: Layer[] }
interface DataPoint { x1: number; x2: number; label: number }

const XOR_DATA: DataPoint[] = [
  { x1: 0, x2: 0, label: 0 },
  { x1: 0, x2: 1, label: 1 },
  { x1: 1, x2: 0, label: 1 },
  { x1: 1, x2: 1, label: 0 },
];

const NEURON_OPTIONS = [2, 4, 8] as const;
const LAYER_OPTIONS = [1, 2] as const;
const GRID_RES = 30;
const LR = 0.5;
const STABLE_THRESHOLD = 20;

// ─── Neural Network (generalized for 1 or 2 hidden layers) ───
function initWeights(neurons: number, numHidden: number): Weights {
  const r = () => (Math.random() - 0.5) * 2;
  const makeLayer = (inSize: number, outSize: number): Layer => ({
    w: Array.from({ length: outSize }, () => Array.from({ length: inSize }, () => r())),
    b: Array.from({ length: outSize }, () => r() * 0.3),
  });
  const layers: Layer[] = [];
  layers.push(makeLayer(2, neurons));            // input → hidden1
  if (numHidden === 2) layers.push(makeLayer(neurons, neurons)); // hidden1 → hidden2
  layers.push(makeLayer(neurons, 1));             // lastHidden → output
  return { layers };
}

function countParams(w: Weights): number {
  let total = 0;
  for (const l of w.layers) {
    total += l.w.length * l.w[0].length + l.b.length;
  }
  return total;
}

function relu(x: number) { return Math.max(0, x); }
function sigmoid(x: number) { return 1 / (1 + Math.exp(-Math.min(Math.max(x, -500), 500))); }

function forward(w: Weights, x1: number, x2: number) {
  let input = [x1, x2];
  const activations: number[][] = [input]; // activations[0] = input
  const preActs: number[][] = [];

  for (let li = 0; li < w.layers.length; li++) {
    const layer = w.layers[li];
    const isLast = li === w.layers.length - 1;
    const z: number[] = [];
    const a: number[] = [];
    for (let j = 0; j < layer.b.length; j++) {
      let sum = layer.b[j];
      for (let k = 0; k < input.length; k++) sum += layer.w[j][k] * input[k];
      z.push(sum);
      a.push(isLast ? sigmoid(sum) : relu(sum));
    }
    preActs.push(z);
    activations.push(a);
    input = a;
  }
  return { activations, preActs, output: activations[activations.length - 1][0] };
}

function trainStep(w: Weights, data: DataPoint[]): { loss: number; correct: number } {
  const numLayers = w.layers.length;
  // Initialize gradient accumulators
  const dw: number[][][] = w.layers.map(l => l.w.map(row => row.map(() => 0)));
  const db: number[][] = w.layers.map(l => l.b.map(() => 0));

  let totalLoss = 0;
  let correct = 0;

  for (const d of data) {
    const { activations, preActs, output } = forward(w, d.x1, d.x2);
    if ((output >= 0.5 ? 1 : 0) === d.label) correct++;
    const eps = 1e-7;
    totalLoss += -(d.label * Math.log(output + eps) + (1 - d.label) * Math.log(1 - output + eps));

    // Backprop
    let delta: number[] = [output - d.label]; // output layer delta (BCE + sigmoid)

    for (let li = numLayers - 1; li >= 0; li--) {
      const layer = w.layers[li];
      const inp = activations[li]; // input to this layer

      // Accumulate gradients
      for (let j = 0; j < layer.b.length; j++) {
        db[li][j] += delta[j];
        for (let k = 0; k < inp.length; k++) {
          dw[li][j][k] += delta[j] * inp[k];
        }
      }

      // Propagate delta to previous layer (if not first layer)
      if (li > 0) {
        const prevZ = preActs[li - 1];
        const newDelta: number[] = new Array(prevZ.length).fill(0);
        for (let k = 0; k < prevZ.length; k++) {
          let sum = 0;
          for (let j = 0; j < layer.b.length; j++) {
            sum += layer.w[j][k] * delta[j];
          }
          newDelta[k] = sum * (prevZ[k] > 0 ? 1 : 0); // ReLU derivative
        }
        delta = newDelta;
      }
    }
  }

  // Update weights
  const m = data.length;
  for (let li = 0; li < numLayers; li++) {
    const layer = w.layers[li];
    for (let j = 0; j < layer.b.length; j++) {
      layer.b[j] -= LR * db[li][j] / m;
      for (let k = 0; k < layer.w[j].length; k++) {
        layer.w[j][k] -= LR * dw[li][j][k] / m;
      }
    }
  }
  return { loss: totalLoss / m, correct };
}

function computeGrid(w: Weights): number[][] {
  const grid: number[][] = [];
  for (let j = 0; j <= GRID_RES; j++) {
    const row: number[] = [];
    for (let i = 0; i <= GRID_RES; i++) {
      row.push(forward(w, i / GRID_RES, j / GRID_RES).output);
    }
    grid.push(row);
  }
  return grid;
}

// ─── SVG Helpers ───
const BW = 300, BH = 260, BPAD = 36;
const toSvgX = (v: number) => BPAD + v * (BW - 2 * BPAD);
const toSvgY = (v: number) => BH - BPAD - v * (BH - 2 * BPAD);

// ─── Scale bar ───
const SCALE_MARKERS = [
  { label: 'AlexNet', value: 60_000_000, color: C.amber },
  { label: 'GPT-3', value: 175_000_000_000, color: C.cyan },
  { label: 'GPT-4', value: 1_800_000_000_000, color: C.rose },
];
function logPos(val: number) { return Math.log10(Math.max(val, 1)) / 13; }
function formatParam(v: number) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(0)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)}만`;
  return `${v}`;
}

// ─── Component ───
export default function NetworkBuilder() {
  const [neurons, setNeurons] = useState(2);
  const [numHidden, setNumHidden] = useState(1);
  const [running, setRunning] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [loss, setLoss] = useState<number | null>(null);
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [trained, setTrained] = useState(false);
  const [weightsSnapshot, setWeightsSnapshot] = useState<Weights | null>(null);

  const weightsRef = useRef<Weights>(initWeights(2, 1));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const epochRef = useRef(0);
  const stableRef = useRef(0);
  const runningRef = useRef(false);

  const paramCount = weightsSnapshot ? countParams(weightsSnapshot) : countParams(initWeights(neurons, numHidden));

  const reset = useCallback((n?: number, nh?: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const nn = n ?? neurons;
    const nnh = nh ?? numHidden;
    weightsRef.current = initWeights(nn, nnh);
    epochRef.current = 0;
    stableRef.current = 0;
    runningRef.current = false;
    setRunning(false);
    setEpoch(0);
    setAccuracy(0);
    setLoss(null);
    setGrid(null);
    setSucceeded(false);
    setTrained(false);
    setWeightsSnapshot(null);
  }, [neurons, numHidden]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const doEpoch = useCallback(() => {
    if (!runningRef.current) return;
    const { loss: l, correct } = trainStep(weightsRef.current, XOR_DATA);
    epochRef.current++;
    const ep = epochRef.current;

    if (correct === 4) stableRef.current++; else stableRef.current = 0;
    const done = stableRef.current >= STABLE_THRESHOLD;

    setEpoch(ep);
    setAccuracy(correct);
    setLoss(l);

    if (ep <= 3 || ep % 5 === 0 || done) {
      setGrid(computeGrid(weightsRef.current));
      setWeightsSnapshot(JSON.parse(JSON.stringify(weightsRef.current)));
    }
    if (done) { runningRef.current = false; setRunning(false); setSucceeded(true); return; }
    if (ep >= 3000) { runningRef.current = false; setRunning(false); return; }
    timerRef.current = setTimeout(doEpoch, 80);
  }, []);

  const toggleRun = () => {
    if (running) {
      runningRef.current = false; setRunning(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      runningRef.current = true; setRunning(true); setTrained(true);
      doEpoch();
    }
  };

  const changeNeurons = (n: number) => { if (running) return; setNeurons(n); reset(n, numHidden); };
  const changeLayers = (nh: number) => { if (running) return; setNumHidden(nh); reset(neurons, nh); };

  // ─── Heatmap ───
  const gridRects = useMemo(() => {
    if (!grid) return null;
    const cellW = (BW - 2 * BPAD) / GRID_RES;
    const cellH = (BH - 2 * BPAD) / GRID_RES;
    const rects: JSX.Element[] = [];
    for (let j = 0; j < GRID_RES; j++) {
      for (let i = 0; i < GRID_RES; i++) {
        const val = (grid[j][i] + grid[j][i + 1] + grid[j + 1][i] + grid[j + 1][i + 1]) / 4;
        const r = Math.round(val * 239 + (1 - val) * 59);
        const g = Math.round(val * 68 + (1 - val) * 130);
        const b = Math.round(val * 68 + (1 - val) * 246);
        rects.push(
          <rect key={`g${j}-${i}`}
            x={toSvgX(i / GRID_RES)} y={toSvgY((j + 1) / GRID_RES)}
            width={cellW} height={cellH}
            fill={`rgba(${r},${g},${b},0.25)`}
          />
        );
      }
    }
    return rects;
  }, [grid]);

  // ─── Contour ───
  const contourLines = useMemo(() => {
    if (!grid) return null;
    const segs: JSX.Element[] = [];
    let idx = 0;
    for (let j = 0; j < GRID_RES; j++) {
      for (let i = 0; i < GRID_RES; i++) {
        const vals = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]];
        for (let e = 0; e < 4; e++) {
          const e2 = (e + 1) % 4;
          if ((vals[e] - 0.5) * (vals[e2] - 0.5) < 0) {
            const t1 = (0.5 - vals[e]) / (vals[e2] - vals[e]);
            for (let f = e + 1; f < 4; f++) {
              const f2 = (f + 1) % 4;
              if ((vals[f] - 0.5) * (vals[f2] - 0.5) < 0) {
                const t2 = (0.5 - vals[f]) / (vals[f2] - vals[f]);
                const corners = [
                  [i / GRID_RES, j / GRID_RES], [(i + 1) / GRID_RES, j / GRID_RES],
                  [(i + 1) / GRID_RES, (j + 1) / GRID_RES], [i / GRID_RES, (j + 1) / GRID_RES],
                ];
                const x1 = corners[e][0] + t1 * (corners[e2][0] - corners[e][0]);
                const y1 = corners[e][1] + t1 * (corners[e2][1] - corners[e][1]);
                const x2 = corners[f][0] + t2 * (corners[f2][0] - corners[f][0]);
                const y2 = corners[f][1] + t2 * (corners[f2][1] - corners[f][1]);
                segs.push(
                  <line key={`c${idx++}`}
                    x1={toSvgX(x1)} y1={toSvgY(y1)} x2={toSvgX(x2)} y2={toSvgY(y2)}
                    stroke={succeeded ? C.emerald : C.violet} strokeWidth={succeeded ? 3 : 2} opacity={0.9}
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
    return segs;
  }, [grid, succeeded]);

  // ─── Network Diagram layout ───
  const NW = 360, NH = 200;
  const totalCols = 2 + numHidden; // input + hidden layers + output
  const layerX = Array.from({ length: totalCols }, (_, i) => 40 + i * ((NW - 80) / (totalCols - 1)));
  const inputY = [70, 130];
  const outputY = [100];
  const hiddenYs = useMemo(() => {
    const result: number[][] = [];
    for (let l = 0; l < numHidden; l++) {
      const n = neurons;
      if (n === 1) { result.push([100]); continue; }
      const top = 20, bot = 180;
      result.push(Array.from({ length: n }, (_, i) => top + i * (bot - top) / (n - 1)));
    }
    return result;
  }, [neurons, numHidden]);

  const neuronR = neurons <= 4 ? 13 : 9;

  // ─── Render ───
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.bg}, rgba(30,20,60,0.97))`,
      borderRadius: 16, padding: '20px 18px 18px', color: C.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      border: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 99,
        }}>인터랙티브</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>뉴런을 쌓아봅시다</span>
      </div>
      <p style={{ color: C.muted, fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>
        은닉 뉴런 수와 은닉층 수를 바꿔가며 XOR 학습을 비교해보세요.
      </p>

      {/* Selectors: neurons + layers */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Neuron count */}
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, fontWeight: 600 }}>은닉 뉴런 수</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {NEURON_OPTIONS.map(n => {
              const active = neurons === n;
              return (
                <button key={n} onClick={() => changeNeurons(n)} disabled={running} style={{
                  flex: 1, background: active ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : C.card,
                  color: active ? '#fff' : C.muted,
                  border: `1px solid ${active ? 'transparent' : C.border}`,
                  borderRadius: 8, padding: '8px 6px', cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running && !active ? 0.5 : 1, transition: 'all 0.2s',
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: mono }}>{n}개</div>
                </button>
              );
            })}
          </div>
        </div>
        {/* Layer count */}
        <div style={{ flex: '1 1 140px' }}>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, fontWeight: 600 }}>은닉층 수</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {LAYER_OPTIONS.map(nh => {
              const active = numHidden === nh;
              return (
                <button key={nh} onClick={() => changeLayers(nh)} disabled={running} style={{
                  flex: 1, background: active ? 'linear-gradient(135deg, #10b981, #059669)' : C.card,
                  color: active ? '#fff' : C.muted,
                  border: `1px solid ${active ? 'transparent' : C.border}`,
                  borderRadius: 8, padding: '8px 6px', cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running && !active ? 0.5 : 1, transition: 'all 0.2s',
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: mono }}>{nh}층</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {/* Network diagram */}
        <div style={{
          flex: '1 1 300px', minWidth: 260,
          background: 'rgba(8,12,24,0.6)', borderRadius: 12,
          border: `1px solid ${C.borderLight}`, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>네트워크 구조</span>
            <span style={{ fontSize: 11, fontFamily: mono, color: C.violet }}>파라미터 {paramCount}개</span>
          </div>
          <svg viewBox={`0 0 ${NW} ${NH}`} style={{ width: '100%', display: 'block' }}>
            {/* Connections */}
            {weightsSnapshot && weightsSnapshot.layers.map((layer, li) => {
              const fromY = li === 0 ? inputY : hiddenYs[li - 1];
              const toY = li === weightsSnapshot.layers.length - 1 ? outputY : hiddenYs[li];
              const fromX = layerX[li];
              const toX = layerX[li + 1];
              return fromY.map((fy, fi) =>
                toY.map((ty, ti) => {
                  const w = layer.w[ti]?.[fi] ?? 0;
                  const absW = Math.abs(w);
                  return (
                    <line key={`conn-${li}-${fi}-${ti}`}
                      x1={fromX + neuronR} y1={fy} x2={toX - neuronR} y2={ty}
                      stroke={w >= 0 ? C.emerald : C.rose}
                      strokeWidth={Math.min(4, 0.5 + absW * 1.2)}
                      opacity={Math.min(0.85, 0.15 + absW * 0.25)}
                    />
                  );
                })
              );
            })}
            {/* Default connections (before training) */}
            {!weightsSnapshot && (() => {
              const allFromTo: [number, number[], number, number[]][] = [];
              allFromTo.push([0, inputY, 1, hiddenYs[0]]);
              if (numHidden === 2) allFromTo.push([1, hiddenYs[0], 2, hiddenYs[1]]);
              allFromTo.push([numHidden, hiddenYs[numHidden - 1], numHidden + 1, outputY]);
              return allFromTo.map(([fi, fromYArr, ti, toYArr]) =>
                fromYArr.map((fy, fIdx) =>
                  toYArr.map((ty, tIdx) => (
                    <line key={`def-${fi}-${fIdx}-${ti}-${tIdx}`}
                      x1={layerX[fi] + neuronR} y1={fy}
                      x2={layerX[ti] - neuronR} y2={ty}
                      stroke={C.dim} strokeWidth={0.5} opacity={0.15}
                    />
                  ))
                )
              );
            })()}

            {/* Input neurons */}
            {inputY.map((y, i) => (
              <g key={`in-${i}`}>
                <circle cx={layerX[0]} cy={y} r={neuronR}
                  fill="rgba(59,130,246,0.15)" stroke={C.blue} strokeWidth={1.5} />
                <text x={layerX[0]} y={y + 4} textAnchor="middle"
                  fill={C.blue} fontSize={11} fontFamily={mono} fontWeight={600}>
                  {i === 0 ? 'x\u2081' : 'x\u2082'}
                </text>
              </g>
            ))}
            {/* Hidden neurons */}
            {hiddenYs.map((ys, li) =>
              ys.map((y, i) => (
                <g key={`h-${li}-${i}`}>
                  <circle cx={layerX[li + 1]} cy={y} r={neuronR}
                    fill="rgba(16,185,129,0.15)" stroke={C.emerald} strokeWidth={1.5} />
                  <text x={layerX[li + 1]} y={y + (neurons <= 4 ? 4 : 3)} textAnchor="middle"
                    fill={C.emerald} fontSize={neurons <= 4 ? 10 : 7} fontFamily={mono} fontWeight={600}>
                    {numHidden === 1 ? `h${i + 1}` : `h${li + 1}.${i + 1}`}
                  </text>
                </g>
              ))
            )}
            {/* Output neuron */}
            <circle cx={layerX[totalCols - 1]} cy={outputY[0]} r={neuronR}
              fill="rgba(139,92,246,0.15)" stroke={C.violet} strokeWidth={1.5} />
            <text x={layerX[totalCols - 1]} y={outputY[0] + 4} textAnchor="middle"
              fill={C.violet} fontSize={11} fontFamily={mono} fontWeight={600}>y</text>

            {/* Layer labels */}
            <text x={layerX[0]} y={NH - 3} textAnchor="middle" fill={C.dim} fontSize={8}>입력(2)</text>
            {hiddenYs.map((_, li) => (
              <text key={`lbl-h${li}`} x={layerX[li + 1]} y={NH - 3} textAnchor="middle" fill={C.dim} fontSize={8}>
                은닉{numHidden > 1 ? `${li + 1}` : ''}({neurons})
              </text>
            ))}
            <text x={layerX[totalCols - 1]} y={NH - 3} textAnchor="middle" fill={C.dim} fontSize={8}>출력(1)</text>

            {/* Activation labels */}
            <text x={(layerX[0] + layerX[1]) / 2} y={12} textAnchor="middle"
              fill={C.emerald} fontSize={9} fontFamily={mono} opacity={0.7}>ReLU</text>
            {numHidden === 2 && (
              <text x={(layerX[1] + layerX[2]) / 2} y={12} textAnchor="middle"
                fill={C.emerald} fontSize={9} fontFamily={mono} opacity={0.7}>ReLU</text>
            )}
            <text x={(layerX[totalCols - 2] + layerX[totalCols - 1]) / 2} y={12} textAnchor="middle"
              fill={C.violet} fontSize={9} fontFamily={mono} opacity={0.7}>sig</text>
          </svg>
          <div style={{ padding: '4px 12px 8px', display: 'flex', gap: 12, fontSize: 10, color: C.dim }}>
            <span><span style={{ color: C.emerald }}>&#9644;</span> 양수</span>
            <span><span style={{ color: C.rose }}>&#9644;</span> 음수</span>
            <span style={{ marginLeft: 'auto' }}>굵기 = |가중치|</span>
          </div>
        </div>

        {/* Decision boundary */}
        <div style={{
          flex: '1 1 280px', minWidth: 260,
          background: 'rgba(8,12,24,0.6)', borderRadius: 12,
          border: `1px solid ${C.borderLight}`, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px 4px', fontSize: 12, color: C.muted, fontWeight: 600 }}>결정 경계</div>
          <svg viewBox={`0 0 ${BW} ${BH}`} style={{ width: '100%', display: 'block' }}>
            {[0, 0.25, 0.5, 0.75, 1].map(v =>
              [0, 0.25, 0.5, 0.75, 1].map(u =>
                <circle key={`d${v}-${u}`} cx={toSvgX(u)} cy={toSvgY(v)} r={1.2} fill="#1e293b" />
              )
            )}
            <line x1={BPAD} y1={BH - BPAD} x2={BW - BPAD} y2={BH - BPAD} stroke="#334155" strokeWidth={1} />
            <line x1={BPAD} y1={BPAD} x2={BPAD} y2={BH - BPAD} stroke="#334155" strokeWidth={1} />
            <text x={BW / 2} y={BH - 8} textAnchor="middle" fill={C.dim} fontSize={10} fontFamily={mono}>x&#x2081;</text>
            <text x={8} y={BH / 2} textAnchor="middle" fill={C.dim} fontSize={10} fontFamily={mono}
              transform={`rotate(-90,8,${BH / 2})`}>x&#x2082;</text>
            {[0, 1].map(v => (
              <g key={`ax${v}`}>
                <text x={toSvgX(v)} y={BH - BPAD + 14} textAnchor="middle" fill={C.dim} fontSize={9}>{v}</text>
                <text x={BPAD - 10} y={toSvgY(v) + 3} textAnchor="middle" fill={C.dim} fontSize={9}>{v}</text>
              </g>
            ))}
            {gridRects}
            {contourLines}
            {XOR_DATA.map((d, i) => {
              const pred = grid ? forward(weightsRef.current, d.x1, d.x2).output : null;
              const isCorrect = pred !== null && ((pred >= 0.5 ? 1 : 0) === d.label);
              return (
                <g key={`pt${i}`}>
                  <circle cx={toSvgX(d.x1)} cy={toSvgY(d.x2)} r={10}
                    fill={d.label === 1 ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}
                    stroke={d.label === 1 ? C.rose : C.blue} strokeWidth={2} />
                  <text x={toSvgX(d.x1)} y={toSvgY(d.x2) + 4} textAnchor="middle"
                    fill={d.label === 1 ? C.rose : C.blue} fontSize={11} fontWeight={700} fontFamily={mono}>
                    {d.label}
                  </text>
                  {trained && pred !== null && (
                    <text x={toSvgX(d.x1) + 14} y={toSvgY(d.x2) - 8}
                      fill={isCorrect ? C.emerald : C.rose} fontSize={8} fontFamily={mono}>
                      {isCorrect ? '✓' : '✗'}
                    </text>
                  )}
                </g>
              );
            })}
            {!grid && (
              <text x={BW / 2} y={BH / 2} textAnchor="middle" fill={C.dim} fontSize={12}>
                학습을 시작하면 경계가 나타납니다
              </text>
            )}
          </svg>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: '파라미터', value: `${paramCount}개`, color: C.violet },
          { label: '에포크', value: epoch > 0 ? `${epoch}` : '—', color: C.amber },
          { label: '정확도', value: trained ? `${accuracy}/4` : '—',
            color: accuracy === 4 ? C.emerald : (trained ? C.rose : C.muted) },
        ].map(m => (
          <div key={m.label} style={{
            background: C.card, borderRadius: 8, padding: '8px 10px', textAlign: 'center',
            border: `1px solid ${C.borderLight}`,
          }}>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: mono, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={toggleRun} disabled={succeeded} style={{
          flex: 1,
          background: running ? 'linear-gradient(135deg, #f59e0b, #d97706)'
            : succeeded ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px',
          fontSize: 14, fontWeight: 600, cursor: succeeded ? 'default' : 'pointer',
          opacity: succeeded ? 0.8 : 1,
        }}>
          {succeeded ? '✓ 학습 완료' : running ? '⏸ 일시 정지' : '▶ 학습 시작'}
        </button>
        <button onClick={() => reset()} style={{
          background: C.card, color: C.muted, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: '10px 16px', fontSize: 13, cursor: 'pointer',
        }}>초기화</button>
      </div>

      {/* Success message */}
      {succeeded && (
        <div style={{
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 14,
          fontSize: 13, color: C.emerald, lineHeight: 1.5,
        }}>
          {numHidden === 1
            ? `은닉층 1개, 뉴런 ${neurons}개(파라미터 ${paramCount}개)로 XOR을 풀었습니다!`
            : `은닉층 2개, 뉴런 ${neurons}개씩(파라미터 ${paramCount}개)으로 XOR을 풀었습니다! 층이 깊어질수록 더 복잡한 패턴을 학습할 수 있습니다.`}
        </div>
      )}

      {/* Scale bar */}
      <div style={{
        background: C.card, borderRadius: 10, padding: '12px 14px',
        border: `1px solid ${C.borderLight}`,
      }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 8, fontWeight: 600 }}>
          파라미터 규모 비교 (로그 스케일)
        </div>
        <div style={{ position: 'relative', height: 32, marginBottom: 4 }}>
          <div style={{
            position: 'absolute', top: 10, left: 0, right: 0, height: 6,
            background: 'rgba(71,85,105,0.2)', borderRadius: 3,
          }} />
          <div style={{
            position: 'absolute', top: 10, left: 0, height: 6,
            width: `${logPos(paramCount) * 100}%`,
            background: `linear-gradient(90deg, ${C.violet}, ${C.blue})`,
            borderRadius: 3, transition: 'width 0.3s',
          }} />
          <div style={{
            position: 'absolute', top: 4, left: `${logPos(paramCount) * 100}%`,
            transform: 'translateX(-50%)',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: C.violet, border: '2px solid #fff',
              boxShadow: `0 0 8px ${C.violet}`,
            }} />
          </div>
          {SCALE_MARKERS.map(m => (
            <div key={m.label} style={{
              position: 'absolute', top: 6, left: `${logPos(m.value) * 100}%`,
              transform: 'translateX(-50%)',
            }}>
              <div style={{ width: 2, height: 14, background: m.color, opacity: 0.6, margin: '0 auto' }} />
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', height: 28, fontSize: 9, color: C.dim }}>
          <span style={{
            position: 'absolute', left: `${logPos(paramCount) * 100}%`,
            transform: 'translateX(-50%)', color: C.violet, fontWeight: 700, fontSize: 10,
          }}>현재 {paramCount}개</span>
          {SCALE_MARKERS.map(m => (
            <span key={m.label} style={{
              position: 'absolute', left: `${logPos(m.value) * 100}%`,
              transform: 'translateX(-50%)', color: m.color, whiteSpace: 'nowrap', top: 14,
            }}>{m.label} ({formatParam(m.value)})</span>
          ))}
        </div>
      </div>
    </div>
  );
}
