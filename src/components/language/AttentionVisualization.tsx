import { useState, useMemo, useCallback } from 'react';

// ─── Color constants (same dark theme) ───
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

// ─── Sentence data with pre-computed attention ───
interface SentenceData {
  id: string;
  tabLabel: string;
  text: string;
  tokens: string[];
  attention: number[][];
  highlight?: { token: string; explanation: string };
}

const SENTENCES: SentenceData[] = [
  {
    id: 'french',
    tabLabel: '\uBB38\uC7A51',
    text: '\uB098\uB294 \uD504\uB791\uC2A4\uC5D0\uC11C \uD0DC\uC5B4\uB098\uC11C \uC5B4\uB9B4 \uB54C\uBD80\uD130 \uD504\uB791\uC2A4\uC5B4\uB97C \uC798\uD569\uB2C8\uB2E4',
    tokens: ['\uB098\uB294', '\uD504\uB791\uC2A4\uC5D0\uC11C', '\uD0DC\uC5B4\uB098\uC11C', '\uC5B4\uB9B4', '\uB54C\uBD80\uD130', '\uD504\uB791\uC2A4\uC5B4\uB97C', '\uC798\uD569\uB2C8\uB2E4'],
    attention: [
      // 나는
      [0.15, 0.05, 0.10, 0.05, 0.05, 0.10, 0.50],
      // 프랑스에서
      [0.08, 0.20, 0.25, 0.05, 0.05, 0.30, 0.07],
      // 태어나서
      [0.10, 0.35, 0.15, 0.10, 0.10, 0.10, 0.10],
      // 어릴
      [0.05, 0.05, 0.15, 0.10, 0.45, 0.10, 0.10],
      // 때부터
      [0.05, 0.05, 0.10, 0.40, 0.10, 0.15, 0.15],
      // 프랑스어를 → strongly attends to 프랑스에서
      [0.03, 0.65, 0.07, 0.03, 0.02, 0.10, 0.10],
      // 잘합니다
      [0.15, 0.10, 0.05, 0.05, 0.05, 0.40, 0.20],
    ],
  },
  {
    id: 'bank-money',
    tabLabel: '\uBB38\uC7A52: \uC740\uD589(\uAE08\uC735)',
    text: '\uB098\uB294 \uC740\uD589\uC5D0 \uB3C8\uC744 \uB9E1\uACBC\uB2E4',
    tokens: ['\uB098\uB294', '\uC740\uD589\uC5D0', '\uB3C8\uC744', '\uB9E1\uACBC\uB2E4'],
    attention: [
      // 나는
      [0.20, 0.15, 0.15, 0.50],
      // 은행에 → attends to 돈, 맡겼다
      [0.05, 0.15, 0.45, 0.35],
      // 돈을
      [0.05, 0.40, 0.15, 0.40],
      // 맡겼다
      [0.10, 0.35, 0.35, 0.20],
    ],
    highlight: {
      token: '\uC740\uD589',
      explanation: '"\uC740\uD589"\uC774 "\uB3C8"\uACFC "\uB9E1\uACBC\uB2E4"\uC5D0 \uC8FC\uBAA9 \u2192 \uC774\uAC83\uC740 \uAE08\uC735 \uC740\uD589\uC785\uB2C8\uB2E4',
    },
  },
  {
    id: 'bank-river',
    tabLabel: '\uBB38\uC7A53: \uC740\uD589(\uAC15)',
    text: '\uAC15 \uC740\uD589\uC5D0 \uAF43\uC774 \uD53C\uC5C8\uB2E4',
    tokens: ['\uAC15', '\uC740\uD589\uC5D0', '\uAF43\uC774', '\uD53C\uC5C8\uB2E4'],
    attention: [
      // 강
      [0.20, 0.40, 0.20, 0.20],
      // 은행에 → attends to 강, 꽃
      [0.50, 0.10, 0.30, 0.10],
      // 꽃이
      [0.15, 0.30, 0.15, 0.40],
      // 피었다
      [0.10, 0.15, 0.50, 0.25],
    ],
    highlight: {
      token: '\uC740\uD589',
      explanation: '"\uC740\uD589"\uC774 "\uAC15"\uACFC "\uAF43"\uC5D0 \uC8FC\uBAA9 \u2192 \uC774\uAC83\uC740 \uAC15 \uC740\uD589(riverbank)\uC785\uB2C8\uB2E4',
    },
  },
];

// ─── Heatmap color from weight ───
function weightToColor(w: number): string {
  // Interpolate from dark blue (low) to bright amber (high)
  const t = Math.min(Math.max(w, 0), 1);
  if (t < 0.2) {
    return `rgba(30,41,59,${0.3 + t * 2})`;
  }
  const r = Math.round(30 + t * 215);
  const g = Math.round(41 + t * 117);
  const b = Math.round(59 - t * 40);
  return `rgba(${r},${g},${b},${0.3 + t * 0.7})`;
}

function weightToOpacity(w: number): number {
  return 0.1 + w * 0.9;
}

// ─── SVG dimensions for bipartite graph ───
const BG_W = 600;
const BG_H = 240;
const BG_PAD_X = 30;
const BG_PAD_Y = 50;

export default function AttentionVisualization() {
  const [selectedSentenceId, setSelectedSentenceId] = useState('french');
  const [mode, setMode] = useState<'heatmap' | 'graph'>('heatmap');
  const [selectedToken, setSelectedToken] = useState<number | null>(null);

  const sentence = useMemo(
    () => SENTENCES.find(s => s.id === selectedSentenceId)!,
    [selectedSentenceId],
  );

  const handleSelectSentence = useCallback((id: string) => {
    setSelectedSentenceId(id);
    setSelectedToken(null);
  }, []);

  const handleTokenClick = useCallback((idx: number) => {
    setSelectedToken(prev => (prev === idx ? null : idx));
  }, []);

  const n = sentence.tokens.length;

  // ─── Heatmap rendering ───
  const cellSize = Math.min(56, Math.floor(480 / (n + 1)));
  const heatmapSize = cellSize * (n + 1);

  // ─── Bipartite graph rendering ───
  const tokenSpacing = (BG_W - 2 * BG_PAD_X) / (n - 1 || 1);

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
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 14 }}>&#x1F50D;</span>
          <span style={{ color: '#fcd34d', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
            어텐션 메커니즘
          </span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          어디를 주목할 것인가
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          각 단어가 다른 단어에 얼마나 주목하는지 확인하세요. 단어를 클릭해 보세요.
        </p>
      </div>

      {/* ─── Sentence tabs ─── */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {SENTENCES.map(s => (
          <button
            key={s.id}
            onClick={() => handleSelectSentence(s.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: selectedSentenceId === s.id
                ? `2px solid ${C.amber}`
                : `1px solid ${C.borderLight}`,
              background: selectedSentenceId === s.id
                ? 'rgba(245,158,11,0.15)'
                : 'rgba(30,41,59,0.5)',
              color: selectedSentenceId === s.id ? C.amber : C.muted,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {s.tabLabel}
          </button>
        ))}
      </div>

      {/* ─── Current sentence display ─── */}
      <div style={{
        textAlign: 'center', marginBottom: 14, padding: '10px 16px',
        background: 'rgba(30,41,59,0.5)', borderRadius: 12,
        border: `1px solid ${C.borderLight}`,
      }}>
        <span style={{ color: C.dim, fontSize: 11, fontWeight: 600, marginRight: 8 }}>문장:</span>
        <span style={{ color: C.text, fontSize: 14 }}>{sentence.text}</span>
      </div>

      {/* ─── Mode toggle ─── */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
        <button
          onClick={() => setMode('heatmap')}
          style={{
            padding: '6px 16px', borderRadius: 8,
            border: mode === 'heatmap'
              ? `2px solid ${C.blue}`
              : `1px solid ${C.borderLight}`,
            background: mode === 'heatmap'
              ? 'rgba(59,130,246,0.12)'
              : 'rgba(30,41,59,0.4)',
            color: mode === 'heatmap' ? C.blue : C.dim,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {mode === 'heatmap' ? '\u25CF' : '\u25CB'} 히트맵
        </button>
        <button
          onClick={() => setMode('graph')}
          style={{
            padding: '6px 16px', borderRadius: 8,
            border: mode === 'graph'
              ? `2px solid ${C.blue}`
              : `1px solid ${C.borderLight}`,
            background: mode === 'graph'
              ? 'rgba(59,130,246,0.12)'
              : 'rgba(30,41,59,0.4)',
            color: mode === 'graph' ? C.blue : C.dim,
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {mode === 'graph' ? '\u25CF' : '\u25CB'} 그래프
        </button>
      </div>

      {/* ─── Visualization area ─── */}
      <div style={{
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.borderLight}`,
        padding: 16,
        marginBottom: 16,
        overflowX: 'auto',
      }}>
        {mode === 'heatmap' ? (
          /* ─── Heatmap Mode ─── */
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div>
              {/* Column headers (key tokens) */}
              <div style={{ display: 'flex', marginLeft: cellSize }}>
                {sentence.tokens.map((tok, j) => (
                  <div
                    key={`col-${j}`}
                    onClick={() => handleTokenClick(j)}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      paddingBottom: 4,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{
                      fontSize: Math.min(11, cellSize * 0.22),
                      fontWeight: selectedToken === j ? 700 : 500,
                      color: selectedToken === j ? C.amber : C.muted,
                      textAlign: 'center',
                      lineHeight: 1.2,
                      wordBreak: 'keep-all' as const,
                      whiteSpace: 'nowrap' as const,
                    }}>
                      {tok}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {sentence.tokens.map((rowTok, i) => (
                <div key={`row-${i}`} style={{ display: 'flex' }}>
                  {/* Row label */}
                  <div
                    onClick={() => handleTokenClick(i)}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      fontSize: Math.min(11, cellSize * 0.22),
                      fontWeight: selectedToken === i ? 700 : 500,
                      color: selectedToken === i ? C.amber : C.muted,
                      textAlign: 'right',
                    }}>
                      {rowTok}
                    </span>
                  </div>

                  {/* Cells */}
                  {sentence.tokens.map((_, j) => {
                    const w = sentence.attention[i][j];
                    const isHighlighted =
                      selectedToken === null ||
                      selectedToken === i ||
                      selectedToken === j;
                    return (
                      <div
                        key={`cell-${i}-${j}`}
                        onClick={() => handleTokenClick(i)}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          background: weightToColor(w),
                          border: '1px solid rgba(15,23,42,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: isHighlighted ? 1 : 0.2,
                          transition: 'all 0.3s',
                          cursor: 'pointer',
                          borderRadius: 3,
                        }}
                      >
                        <span style={{
                          fontFamily: mono,
                          fontSize: Math.min(10, cellSize * 0.2),
                          color: w > 0.35 ? '#fff' : C.dim,
                          fontWeight: w > 0.35 ? 700 : 400,
                        }}>
                          {w >= 0.05 ? w.toFixed(2) : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Color legend */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, marginTop: 12,
              }}>
                <span style={{ color: C.dim, fontSize: 10 }}>낮음</span>
                <div style={{ display: 'flex', gap: 1 }}>
                  {[0.0, 0.15, 0.3, 0.45, 0.6, 0.8].map(v => (
                    <div key={v} style={{
                      width: 20, height: 10, borderRadius: 2,
                      background: weightToColor(v),
                    }} />
                  ))}
                </div>
                <span style={{ color: C.dim, fontSize: 10 }}>높음</span>
              </div>

              {/* Axis labels */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 8,
                padding: '0 8px',
              }}>
                <span style={{ color: C.dim, fontSize: 10 }}>
                  {'\u2191'} 쿼리 (주목하는 단어)
                </span>
                <span style={{ color: C.dim, fontSize: 10 }}>
                  {'\u2192'} 키 (주목받는 단어)
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ─── Bipartite Graph Mode ─── */
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg viewBox={`0 0 ${BG_W} ${BG_H}`}
              style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block' }}>
              {/* Connection lines */}
              {sentence.tokens.map((_, i) =>
                sentence.tokens.map((_, j) => {
                  const w = sentence.attention[i][j];
                  if (w < 0.05) return null;
                  const isHighlighted =
                    selectedToken === null ||
                    selectedToken === i;
                  const x1 = BG_PAD_X + i * tokenSpacing;
                  const x2 = BG_PAD_X + j * tokenSpacing;
                  return (
                    <line
                      key={`line-${i}-${j}`}
                      x1={x1} y1={BG_PAD_Y + 20}
                      x2={x2} y2={BG_H - BG_PAD_Y - 20}
                      stroke={w > 0.3 ? C.amber : C.blue}
                      strokeWidth={Math.max(1, w * 8)}
                      opacity={isHighlighted ? weightToOpacity(w) : 0.05}
                      strokeLinecap="round"
                      style={{ transition: 'opacity 0.3s' }}
                    />
                  );
                })
              )}

              {/* Weight labels on connections (only when a token is selected) */}
              {selectedToken !== null && sentence.tokens.map((_, j) => {
                const w = sentence.attention[selectedToken][j];
                if (w < 0.05) return null;
                const x1 = BG_PAD_X + selectedToken * tokenSpacing;
                const x2 = BG_PAD_X + j * tokenSpacing;
                const mx = (x1 + x2) / 2;
                const my = BG_H / 2;
                return (
                  <text
                    key={`wlabel-${j}`}
                    x={mx} y={my}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={w > 0.3 ? C.amber : C.muted}
                    fontSize={10} fontFamily={mono} fontWeight={600}
                  >
                    {w.toFixed(2)}
                  </text>
                );
              })}

              {/* Top row: query tokens */}
              {sentence.tokens.map((tok, i) => {
                const x = BG_PAD_X + i * tokenSpacing;
                const y = BG_PAD_Y;
                const isSelected = selectedToken === i;
                return (
                  <g key={`top-${i}`}
                    onClick={() => handleTokenClick(i)}
                    style={{ cursor: 'pointer' }}
                  >
                    {isSelected && (
                      <circle cx={x} cy={y} r={18}
                        fill="none" stroke={C.amber} strokeWidth={2} opacity={0.5}>
                        <animate attributeName="r" values="16;20;16" dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0.2;0.5" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle cx={x} cy={y} r={14}
                      fill={isSelected ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.8)'}
                      stroke={isSelected ? C.amber : C.borderLight}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                    <text x={x} y={y + 1}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={isSelected ? C.amber : C.text}
                      fontSize={Math.min(10, 60 / n)} fontWeight={600}
                    >
                      {tok.length > 4 ? tok.slice(0, 3) + '..' : tok}
                    </text>
                  </g>
                );
              })}

              {/* Bottom row: key tokens */}
              {sentence.tokens.map((tok, j) => {
                const x = BG_PAD_X + j * tokenSpacing;
                const y = BG_H - BG_PAD_Y;
                const isTarget = selectedToken !== null && sentence.attention[selectedToken][j] > 0.2;
                return (
                  <g key={`bot-${j}`}
                    onClick={() => handleTokenClick(j)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle cx={x} cy={y} r={14}
                      fill={isTarget ? 'rgba(59,130,246,0.2)' : 'rgba(30,41,59,0.8)'}
                      stroke={isTarget ? C.blue : C.borderLight}
                      strokeWidth={isTarget ? 2 : 1}
                    />
                    <text x={x} y={y + 1}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={isTarget ? C.blue : C.text}
                      fontSize={Math.min(10, 60 / n)} fontWeight={600}
                    >
                      {tok.length > 4 ? tok.slice(0, 3) + '..' : tok}
                    </text>
                  </g>
                );
              })}

              {/* Row labels */}
              <text x={BG_PAD_X - 8} y={BG_PAD_Y + 1}
                textAnchor="end" dominantBaseline="middle"
                fill={C.dim} fontSize={9} fontWeight={600}>
                Query
              </text>
              <text x={BG_PAD_X - 8} y={BG_H - BG_PAD_Y + 1}
                textAnchor="end" dominantBaseline="middle"
                fill={C.dim} fontSize={9} fontWeight={600}>
                Key
              </text>
            </svg>
          </div>
        )}
      </div>

      {/* ─── Token click info panel ─── */}
      {selectedToken !== null && (
        <div style={{
          background: 'rgba(30,41,59,0.6)',
          borderRadius: 14,
          border: `1px solid ${C.borderLight}`,
          padding: 14,
          marginBottom: 14,
        }}>
          <div style={{ color: C.amber, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            "{sentence.tokens[selectedToken]}"의 어텐션 분포
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sentence.tokens.map((tok, j) => {
              const w = sentence.attention[selectedToken][j];
              return (
                <div key={j} style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: w > 0.3
                    ? 'rgba(245,158,11,0.12)'
                    : 'rgba(30,41,59,0.5)',
                  border: w > 0.3
                    ? '1px solid rgba(245,158,11,0.3)'
                    : `1px solid ${C.borderLight}`,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600,
                    color: w > 0.3 ? C.amber : C.muted,
                    marginBottom: 2,
                  }}>
                    {tok}
                  </div>
                  <div style={{
                    fontFamily: mono, fontSize: 11,
                    color: w > 0.3 ? C.text : C.dim,
                    fontWeight: w > 0.3 ? 700 : 400,
                  }}>
                    {(w * 100).toFixed(0)}%
                  </div>
                  {/* Mini bar */}
                  <div style={{
                    width: 50, height: 4, borderRadius: 2, marginTop: 4,
                    background: 'rgba(15,23,42,0.5)',
                  }}>
                    <div style={{
                      width: `${w * 100}%`, height: '100%', borderRadius: 2,
                      background: w > 0.3 ? C.amber : C.blue,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Highlight callout for 은행 sentences ─── */}
      {sentence.highlight && (
        <div style={{
          padding: '14px', borderRadius: 14,
          background: 'rgba(245,158,11,0.06)',
          border: `1px solid rgba(245,158,11,0.15)`,
          marginBottom: 14,
        }}>
          <div style={{ color: C.amber, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            {'\uD83D\uDCA1'} {sentence.highlight.explanation}
          </div>
        </div>
      )}

      {/* ─── Disambiguation callout (shown when bank-money or bank-river) ─── */}
      {(selectedSentenceId === 'bank-money' || selectedSentenceId === 'bank-river') && (
        <div style={{
          padding: '14px 16px', borderRadius: 14,
          background: 'rgba(139,92,246,0.06)',
          border: `1px solid rgba(139,92,246,0.15)`,
          marginBottom: 14,
        }}>
          <div style={{ color: C.violet, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            {'\u26A1'} 같은 글자, 다른 의미 &#x2014; 어텐션이 해결합니다
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
            {selectedSentenceId === 'bank-money' ? (
              <>
                문장2에서 "<strong style={{ color: C.amber }}>은행</strong>"은
                "<strong style={{ color: C.text }}>돈</strong>"과
                "<strong style={{ color: C.text }}>맡겼다</strong>"에 강하게 주목합니다.
                이 문맥 정보로 모델은 이것이 <strong style={{ color: C.amber }}>금융 은행</strong>임을 파악합니다.
              </>
            ) : (
              <>
                문장3에서 "<strong style={{ color: C.amber }}>은행</strong>"은
                "<strong style={{ color: C.text }}>강</strong>"과
                "<strong style={{ color: C.text }}>꽃</strong>"에 강하게 주목합니다.
                같은 글자지만 문맥이 달라 <strong style={{ color: C.amber }}>강 은행(riverbank)</strong>으로 이해합니다.
              </>
            )}
          </div>
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(15,23,42,0.5)',
            fontSize: 11, color: C.dim, lineHeight: 1.7,
          }}>
            어텐션 덕분에 같은 단어도 <strong style={{ color: C.text }}>주변 문맥에 따라 다른 의미</strong>를 가질 수 있습니다.
            이것이 Transformer의 핵심 아이디어입니다.
          </div>
        </div>
      )}

      {/* ─── Bottom explanation ─── */}
      <div style={{
        padding: '14px', borderRadius: 14,
        background: 'rgba(59,130,246,0.06)',
        border: `1px solid rgba(59,130,246,0.15)`,
      }}>
        <div style={{ color: C.blue, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
          {'\uD83D\uDCA1'} 어텐션이란?
        </div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
          각 단어(Query)가 문장의 모든 단어(Key)를 살펴보며 "어디가 나에게 중요한가?"를 점수로 계산합니다.
          점수가 높을수록 그 단어의 정보를 더 많이 가져옵니다.
        </div>
        <div style={{
          marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{
            flex: '1 1 160px', padding: '8px 10px', borderRadius: 8,
            background: 'rgba(15,23,42,0.5)',
            fontSize: 11, color: C.dim, lineHeight: 1.6, textAlign: 'center',
          }}>
            <strong style={{ color: C.text }}>히트맵</strong>: 행 = 주목하는 단어,
            열 = 주목받는 단어, 색 진하기 = 가중치
          </div>
          <div style={{
            flex: '1 1 160px', padding: '8px 10px', borderRadius: 8,
            background: 'rgba(15,23,42,0.5)',
            fontSize: 11, color: C.dim, lineHeight: 1.6, textAlign: 'center',
          }}>
            <strong style={{ color: C.text }}>그래프</strong>: 위 = Query, 아래 = Key,
            선 굵기 = 어텐션 강도
          </div>
        </div>
      </div>
    </div>
  );
}
