import { useState, useMemo } from 'react';

type Mode = 'AND' | 'OR' | 'XOR';

const DATA: Record<Mode, { x1: number; x2: number; label: number }[]> = {
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

// Map data coordinates (0-1) to SVG coordinates
const toSvg = (v: number, pad: number, size: number) => pad + v * (size - 2 * pad);
const W = 380;
const H = 320;
const PAD = 50;

export default function PerceptronSimulator() {
  const [mode, setMode] = useState<Mode>('AND');
  const [w1, setW1] = useState(1.0);
  const [w2, setW2] = useState(1.0);
  const [bias, setBias] = useState(-0.5);

  const points = DATA[mode];

  // Compute predictions and accuracy
  const results = useMemo(() => {
    return points.map((p) => {
      const z = w1 * p.x1 + w2 * p.x2 + bias;
      const pred = z >= 0 ? 1 : 0;
      return { ...p, pred, correct: pred === p.label };
    });
  }, [mode, w1, w2, bias, points]);

  const accuracy = results.filter((r) => r.correct).length;

  // Decision boundary: w1*x1 + w2*x2 + bias = 0
  // x2 = -(w1*x1 + bias) / w2
  const linePoints = useMemo(() => {
    if (Math.abs(w2) < 0.01 && Math.abs(w1) < 0.01) return null;

    const pts: { x: number; y: number }[] = [];

    if (Math.abs(w2) >= 0.01) {
      // Calculate x2 at x1=range boundaries
      for (const x1 of [-0.3, 1.3]) {
        const x2 = -(w1 * x1 + bias) / w2;
        pts.push({ x: x1, y: x2 });
      }
    } else {
      // Vertical line: x1 = -bias/w1
      const x1 = -bias / w1;
      pts.push({ x: x1, y: -0.3 });
      pts.push({ x: x1, y: 1.3 });
    }
    return pts;
  }, [w1, w2, bias]);

  const accColor = accuracy === 4 ? '#10b981' : accuracy >= 3 ? '#f59e0b' : '#ef4444';

  const sliderStyle = {
    width: '100%',
    accentColor: '#6366f1',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(30,32,48,0.97), rgba(20,22,36,0.99))',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid rgba(100,116,139,0.25)',
        maxWidth: '760px',
        margin: '1.5rem auto',
      }}
    >
      {/* Header */}
      <p
        style={{
          color: '#e2e8f0',
          fontSize: '17px',
          fontWeight: 700,
          margin: '0 0 4px',
          textAlign: 'center',
        }}
      >
        퍼셉트론 시뮬레이터
      </p>
      <p
        style={{
          color: '#94a3b8',
          fontSize: '12px',
          margin: '0 0 16px',
          textAlign: 'center',
        }}
      >
        슬라이더로 직선을 움직여 빨간 점과 파란 점을 나눠보세요
      </p>

      {/* Mode selector */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
        {(['AND', 'OR', 'XOR'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              if (m === 'AND') { setW1(1); setW2(1); setBias(-1.5); }
              else if (m === 'OR') { setW1(1); setW2(1); setBias(-0.5); }
              else { setW1(1); setW2(1); setBias(-0.5); }
            }}
            style={{
              padding: '8px 24px',
              borderRadius: '10px',
              border: mode === m ? '2px solid #6366f1' : '1px solid rgba(71,85,105,0.5)',
              background: mode === m ? 'rgba(99,102,241,0.2)' : 'rgba(30,41,59,0.6)',
              color: mode === m ? '#e2e8f0' : '#94a3b8',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {/* SVG Graph */}
        <div style={{ flex: '1 1 350px', minWidth: '300px' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', borderRadius: '12px', background: 'rgba(15,17,28,0.8)' }}>
            {/* Grid */}
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#334155" strokeWidth="1.5" />
            <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#334155" strokeWidth="1.5" />

            {/* Axis labels */}
            <text x={W / 2} y={H - 10} textAnchor="middle" fill="#64748b" fontSize="12">x₁</text>
            <text x={15} y={H / 2} textAnchor="middle" fill="#64748b" fontSize="12" transform={`rotate(-90, 15, ${H / 2})`}>x₂</text>

            {/* Grid ticks */}
            <text x={toSvg(0, PAD, W)} y={H - PAD + 18} textAnchor="middle" fill="#64748b" fontSize="11">0</text>
            <text x={toSvg(1, PAD, W)} y={H - PAD + 18} textAnchor="middle" fill="#64748b" fontSize="11">1</text>
            <text x={PAD - 14} y={toSvg(0, PAD, H) + 4} textAnchor="middle" fill="#64748b" fontSize="11">0</text>
            <text x={PAD - 14} y={toSvg(1, PAD, H) + 4} textAnchor="middle" fill="#64748b" fontSize="11">1</text>

            {/* Decision boundary line */}
            {linePoints && (
              <line
                x1={toSvg(linePoints[0].x, PAD, W)}
                y1={H - toSvg(linePoints[0].y, PAD, H)}
                x2={toSvg(linePoints[1].x, PAD, W)}
                y2={H - toSvg(linePoints[1].y, PAD, H)}
                stroke={accuracy === 4 ? '#10b981' : '#a78bfa'}
                strokeWidth="3"
                strokeDasharray={accuracy === 4 ? 'none' : '8,4'}
                opacity="0.9"
              />
            )}

            {/* Shaded region (above the line = class 1) */}
            {linePoints && (
              <polygon
                points={`${toSvg(linePoints[0].x, PAD, W)},${H - toSvg(linePoints[0].y, PAD, H)} ${toSvg(linePoints[1].x, PAD, W)},${H - toSvg(linePoints[1].y, PAD, H)} ${W - PAD},${PAD} ${PAD},${PAD}`}
                fill={accuracy === 4 ? 'rgba(16,185,129,0.06)' : 'rgba(167,139,250,0.06)'}
              />
            )}

            {/* Data points */}
            {results.map((r, i) => {
              const cx = toSvg(r.x1, PAD, W);
              const cy = H - toSvg(r.x2, PAD, H);
              const fill = r.label === 1 ? '#ef4444' : '#3b82f6';
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={16} fill={fill} opacity={0.85} />
                  <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="700">
                    {r.label}
                  </text>
                  {!r.correct && (
                    <text x={cx + 14} y={cy - 10} fill="#ef4444" fontSize="18" fontWeight="900">
                      ✗
                    </text>
                  )}
                  {r.correct && (
                    <text x={cx + 14} y={cy - 10} fill="#10b981" fontSize="14" fontWeight="900">
                      ✓
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Controls */}
        <div style={{ flex: '1 1 250px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Accuracy */}
          <div
            style={{
              textAlign: 'center',
              padding: '14px',
              borderRadius: '12px',
              background: accuracy === 4 ? 'rgba(16,185,129,0.12)' : 'rgba(30,41,59,0.6)',
              border: `2px solid ${accColor}`,
              transition: 'all 0.3s',
            }}
          >
            <p style={{ color: accColor, fontSize: '28px', fontWeight: 700, margin: '0 0 4px' }}>
              {accuracy}/4
            </p>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
              {accuracy === 4 ? '완벽하게 분류했습니다!' : mode === 'XOR' && accuracy >= 3 ? '이것이 최선입니다...' : '직선을 조절해보세요'}
            </p>
          </div>

          {/* Sliders */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ color: '#fdba74', fontSize: '13px', fontWeight: 600 }}>w₁ (x₁의 영향력)</label>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>{w1.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={w1}
              onChange={(e) => setW1(Number(e.target.value))}
              style={sliderStyle}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ color: '#fdba74', fontSize: '13px', fontWeight: 600 }}>w₂ (x₂의 영향력)</label>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>{w2.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={w2}
              onChange={(e) => setW2(Number(e.target.value))}
              style={sliderStyle}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 600 }}>b (기준선 위치)</label>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>{bias.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={bias}
              onChange={(e) => setBias(Number(e.target.value))}
              style={sliderStyle}
            />
          </div>

          {/* Equation display */}
          <div
            style={{
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(30,41,59,0.6)',
              border: '1px solid rgba(71,85,105,0.3)',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px' }}>직선의 수식</p>
            <p style={{ color: '#e2e8f0', fontSize: '14px', margin: 0, fontFamily: 'monospace' }}>
              {w1.toFixed(1)}·x₁ + {w2.toFixed(1)}·x₂ + ({bias.toFixed(1)}) = 0
            </p>
          </div>

          {/* XOR warning */}
          {mode === 'XOR' && (
            <div
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              <p style={{ color: '#fca5a5', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                아무리 조절해도 4/4가 되지 않습니다. 직선 하나로는 XOR을 풀 수 없다는 것이 <strong>수학적으로 증명</strong>되어 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
