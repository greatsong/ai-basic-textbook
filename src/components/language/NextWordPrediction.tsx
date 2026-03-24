import { useState, useMemo, useCallback } from 'react';

// ─── Preset data ───
interface Preset {
  sentence: string;
  blank: string; // placeholder for blank
  logits: Record<string, number>;
}

const PRESETS: Preset[] = [
  {
    sentence: '오늘 점심에 나는 ___을 먹었다',
    blank: '___',
    logits: { '밥': 3.5, '김치찌개': 2.8, '피자': 2.2, '라면': 2.0, '샌드위치': 1.5, '국수': 1.3 },
  },
  {
    sentence: '한국의 수도는 ___이다',
    blank: '___',
    logits: { '서울': 8.0, '부산': 1.0, '대전': 0.5, '인천': 0.3 },
  },
  {
    sentence: '나는 학교에서 ___을 배웠다',
    blank: '___',
    logits: { '수학': 3.2, '과학': 2.9, '영어': 2.7, '국어': 2.4, '음악': 1.6, '역사': 1.8, '체육': 1.2, '미술': 1.0 },
  },
];

// ─── Softmax with temperature ───
function softmax(logits: Record<string, number>, temperature: number): Record<string, number> {
  const entries = Object.entries(logits);
  const scaled = entries.map(([word, logit]) => [word, logit / temperature] as const);
  const maxVal = Math.max(...scaled.map(([, v]) => v));
  const exps = scaled.map(([word, v]) => [word, Math.exp(v - maxVal)] as const);
  const sumExp = exps.reduce((sum, [, e]) => sum + e, 0);
  const result: Record<string, number> = {};
  for (const [word, e] of exps) {
    result[word] = e / sumExp;
  }
  return result;
}

// ─── Color constants (matching PerceptronLearning style) ───
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
  cyan: '#06b6d4',
  indigo: '#6366f1',
};

const mono = 'var(--sl-font-mono, monospace)';

// ─── Bar colors (gradient from high to low probability) ───
const BAR_COLORS = [
  '#8b5cf6', // violet (1st)
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#10b981', // emerald
  '#64748b', // slate
  '#475569', // dark slate
];

export default function NextWordPrediction() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [temperature, setTemperature] = useState(1.0);
  const [userGuess, setUserGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const preset = PRESETS[presetIdx];

  // Compute probabilities
  const probabilities = useMemo(
    () => softmax(preset.logits, temperature),
    [preset, temperature],
  );

  // Sort by probability descending
  const sorted = useMemo(
    () => Object.entries(probabilities).sort((a, b) => b[1] - a[1]),
    [probabilities],
  );

  // Top word
  const topWord = sorted[0]?.[0] ?? '';
  const topProb = sorted[0]?.[1] ?? 0;

  // Check match
  const isMatch = submitted && userGuess.trim() === topWord;

  // Handlers
  const handleSubmit = useCallback(() => {
    if (userGuess.trim()) setSubmitted(true);
  }, [userGuess]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  }, [handleSubmit]);

  const switchPreset = useCallback(() => {
    const next = (presetIdx + 1) % PRESETS.length;
    setPresetIdx(next);
    setUserGuess('');
    setSubmitted(false);
  }, [presetIdx]);

  const resetGuess = useCallback(() => {
    setUserGuess('');
    setSubmitted(false);
  }, []);

  // Temperature label
  const tempLabel = temperature <= 0.3
    ? '매우 보수적'
    : temperature <= 0.7
      ? '보수적'
      : temperature <= 1.2
        ? '보통'
        : temperature <= 1.6
          ? '창의적'
          : '매우 창의적';

  const tempColor = temperature <= 0.5
    ? C.blue
    : temperature <= 1.0
      ? C.emerald
      : temperature <= 1.5
        ? C.amber
        : C.rose;

  // Render sentence with blank highlighted
  const renderSentence = () => {
    const parts = preset.sentence.split('___');
    return (
      <span>
        {parts[0]}
        <span style={{
          display: 'inline-block',
          minWidth: 60,
          padding: '2px 12px',
          margin: '0 2px',
          borderRadius: 8,
          background: 'rgba(99,102,241,0.15)',
          border: '2px dashed rgba(99,102,241,0.4)',
          color: '#a5b4fc',
          fontWeight: 700,
          textAlign: 'center',
        }}>
          {submitted && userGuess.trim() ? userGuess.trim() : '?'}
        </span>
        {parts[1]}
      </span>
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
          <span style={{ fontSize: 14 }}>&#x1F52E;</span>
          <span style={{ color: '#a5b4fc', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
            다음 단어 예측
          </span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          AI는 어떤 단어를 고를까?
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          빈칸에 들어갈 단어를 예상해서 입력하세요. AI의 예측과 비교해봅시다.
        </p>
      </div>

      {/* ─── Sentence Display ─── */}
      <div style={{
        textAlign: 'center',
        padding: '18px 20px',
        borderRadius: 14,
        background: C.card,
        border: `1px solid ${C.borderLight}`,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text, lineHeight: 1.8 }}>
          {renderSentence()}
        </div>
      </div>

      {/* ─── Input Row ─── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16,
        maxWidth: 500, margin: '0 auto 16px',
      }}>
        <input
          type="text"
          value={userGuess}
          onChange={(e) => { setUserGuess(e.target.value); setSubmitted(false); }}
          onKeyDown={handleKeyDown}
          placeholder="빈칸에 들어갈 단어를 입력..."
          disabled={submitted}
          style={{
            flex: 1,
            padding: '11px 16px',
            borderRadius: 12,
            border: `1px solid ${submitted ? 'rgba(99,102,241,0.3)' : C.borderLight}`,
            background: submitted ? 'rgba(30,41,59,0.3)' : 'rgba(30,41,59,0.6)',
            color: C.text,
            fontSize: 15,
            fontWeight: 600,
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!userGuess.trim()}
            style={{
              padding: '11px 24px', borderRadius: 12, border: 'none',
              background: userGuess.trim()
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'rgba(71,85,105,0.2)',
              color: userGuess.trim() ? '#fff' : C.dim,
              fontSize: 14, fontWeight: 700,
              cursor: userGuess.trim() ? 'pointer' : 'not-allowed',
              boxShadow: userGuess.trim() ? '0 4px 12px rgba(99,102,241,0.2)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            예측 확인
          </button>
        ) : (
          <button
            onClick={resetGuess}
            style={{
              padding: '11px 18px', borderRadius: 12,
              border: `1px solid ${C.borderLight}`,
              background: 'rgba(30,41,59,0.5)',
              color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            다시 입력
          </button>
        )}
      </div>

      {/* ─── Match message ─── */}
      {submitted && (
        <div style={{
          textAlign: 'center', padding: '10px 16px', borderRadius: 12, marginBottom: 16,
          background: isMatch ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.08)',
          border: `1.5px solid ${isMatch ? C.emerald : 'rgba(245,158,11,0.3)'}`,
        }}>
          {isMatch ? (
            <span style={{ color: C.emerald, fontSize: 14, fontWeight: 700 }}>
              AI와 같은 예측! AI도 "{topWord}"을(를) 가장 높은 확률로 선택했습니다
            </span>
          ) : (
            <span style={{ color: C.amber, fontSize: 13 }}>
              여러분의 예측: <strong style={{ color: C.text }}>"{userGuess.trim()}"</strong>
              {' '}| AI의 1위 예측: <strong style={{ color: '#a5b4fc' }}>"{topWord}"</strong> ({(topProb * 100).toFixed(1)}%)
              {Object.keys(preset.logits).includes(userGuess.trim()) && (
                <span style={{ marginLeft: 8, color: C.muted }}>
                  (AI도 "{userGuess.trim()}"을(를) 후보로 보고 있습니다 &#x2014;{' '}
                  {(probabilities[userGuess.trim()] * 100).toFixed(1)}%)
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* ─── Main Content: Bar Chart + Temperature ─── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

        {/* ── Left: Probability Distribution Bar Chart ── */}
        <div style={{ flex: '1 1 420px', minWidth: 300 }}>
          <div style={{
            borderRadius: 14,
            background: C.card,
            border: `1px solid ${C.borderLight}`,
            padding: '16px',
            overflow: 'hidden',
          }}>
            <div style={{
              color: C.dim, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.04em', marginBottom: 12, textTransform: 'uppercase',
            }}>
              AI 예측 확률 분포
            </div>

            {/* Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map(([word, prob], i) => {
                const pct = prob * 100;
                const barColor = BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)];
                const isUserWord = submitted && userGuess.trim() === word;
                return (
                  <div key={word} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Word label */}
                    <div style={{
                      width: 72, textAlign: 'right', flexShrink: 0,
                      fontSize: 14, fontWeight: i === 0 ? 700 : 500,
                      color: isUserWord ? '#a5b4fc' : (i === 0 ? C.text : C.muted),
                      fontFamily: mono,
                    }}>
                      {word}
                      {isUserWord && (
                        <span style={{ fontSize: 9, marginLeft: 4, color: '#a5b4fc' }}>&#x25C0;</span>
                      )}
                    </div>
                    {/* Bar container */}
                    <div style={{ flex: 1, position: 'relative', height: 28 }}>
                      {/* Background track */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        borderRadius: 8,
                        background: 'rgba(15,23,42,0.5)',
                        border: `1px solid ${C.borderLight}`,
                      }} />
                      {/* Filled bar */}
                      <div style={{
                        position: 'absolute', top: 1, left: 1, bottom: 1,
                        width: `${Math.max(pct, 1)}%`,
                        borderRadius: 7,
                        background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
                        opacity: i === 0 ? 1 : 0.7 + 0.3 * (1 - i / sorted.length),
                        transition: 'width 0.4s ease-out',
                        boxShadow: i === 0 ? `0 0 12px ${barColor}40` : 'none',
                      }} />
                      {/* Percentage text */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 8, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        fontSize: 12, fontWeight: 700, fontFamily: mono,
                        color: pct > 50 ? 'rgba(255,255,255,0.95)' : C.text,
                        paddingRight: pct > 15 ? 0 : undefined,
                        paddingLeft: pct <= 15 ? `calc(${Math.max(pct, 1)}% + 8px)` : undefined,
                        justifyContent: pct > 15 ? 'flex-end' : 'flex-start',
                      }}>
                        {pct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explanation text */}
            <div style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.12)',
              fontSize: 12, color: C.muted, lineHeight: 1.7,
            }}>
              AI는 각 후보 단어에 대해 확률을 계산합니다.{' '}
              <strong style={{ color: C.text }}>"{topWord}"</strong>이(가){' '}
              <strong style={{ color: BAR_COLORS[0] }}>{(topProb * 100).toFixed(1)}%</strong>의 확률로 1위입니다.
              {topProb > 0.8 && (
                <span> &#x2014; 거의 확실한 답이 있는 문장입니다.</span>
              )}
              {topProb < 0.4 && (
                <span> &#x2014; 여러 단어가 경쟁하고 있어 다양한 답이 나올 수 있습니다.</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Temperature Control ── */}
        <div style={{ flex: '1 1 240px', minWidth: 240 }}>
          <div style={{
            borderRadius: 14,
            background: C.card,
            border: `1px solid ${C.borderLight}`,
            padding: '16px',
            marginBottom: 12,
          }}>
            <div style={{
              color: C.dim, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.04em', marginBottom: 12, textTransform: 'uppercase',
            }}>
              Temperature (온도)
            </div>

            {/* Current value display */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{
                fontSize: 36, fontWeight: 700, fontFamily: mono,
                color: tempColor,
                lineHeight: 1,
                transition: 'color 0.3s',
              }}>
                {temperature.toFixed(1)}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: tempColor,
                marginTop: 4, transition: 'color 0.3s',
              }}>
                {tempLabel}
              </div>
            </div>

            {/* Slider */}
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10, color: C.dim, marginBottom: 4,
              }}>
                <span>&#x2190; 보수적</span>
                <span>창의적 &#x2192;</span>
              </div>
              <input
                type="range"
                min="0.1" max="2.0" step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: tempColor,
                  cursor: 'pointer',
                  height: 6,
                }}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10, fontFamily: mono, color: C.dim, marginTop: 2,
              }}>
                <span>0.1</span>
                <span>1.0</span>
                <span>2.0</span>
              </div>
            </div>

            {/* Temperature explanation */}
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(15,23,42,0.5)',
              fontSize: 12, color: C.muted, lineHeight: 1.7,
              marginTop: 8,
            }}>
              {temperature <= 0.3 ? (
                <>
                  <strong style={{ color: C.blue }}>낮은 Temperature</strong>: 가장 확실한 답만 선택합니다.
                  1위 단어의 확률이 거의 100%에 가까워집니다.
                  <br />
                  <span style={{ fontSize: 11, color: C.dim }}>
                    시험에서 가장 확실한 답만 쓰는 학생과 같습니다.
                  </span>
                </>
              ) : temperature <= 1.2 ? (
                <>
                  <strong style={{ color: C.emerald }}>중간 Temperature</strong>: 확률에 비례하여 단어를 선택합니다.
                  자연스러운 문장이 만들어지는 구간입니다.
                  <br />
                  <span style={{ fontSize: 11, color: C.dim }}>
                    ChatGPT의 일반 대화에서 주로 사용하는 범위입니다.
                  </span>
                </>
              ) : (
                <>
                  <strong style={{ color: C.rose }}>높은 Temperature</strong>: 확률이 낮은 단어도 자주 선택됩니다.
                  엉뚱하지만 창의적인 결과가 나옵니다.
                  <br />
                  <span style={{ fontSize: 11, color: C.dim }}>
                    시나 소설 같은 창작 작업에 유용하지만, 정확성은 떨어집니다.
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ── Softmax Formula Card ── */}
          <div style={{
            borderRadius: 14,
            background: C.card,
            border: `1px solid ${C.borderLight}`,
            padding: '14px 16px',
            marginBottom: 12,
          }}>
            <div style={{
              color: C.dim, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase',
            }}>
              수식: Softmax + Temperature
            </div>
            <div style={{
              fontFamily: mono, fontSize: 13, color: C.text,
              textAlign: 'center', lineHeight: 2,
              padding: '8px',
              background: 'rgba(15,23,42,0.5)',
              borderRadius: 8,
            }}>
              P(단어) ={' '}
              <span style={{ color: '#a5b4fc' }}>exp</span>
              (로짓 /{' '}
              <span style={{ color: tempColor }}>{temperature.toFixed(1)}</span>
              ) / <span style={{ color: C.dim }}>&#x03A3;</span>
              <span style={{ color: '#a5b4fc' }}>exp</span>
              (로짓<sub>j</sub> /{' '}
              <span style={{ color: tempColor }}>{temperature.toFixed(1)}</span>
              )
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 6, lineHeight: 1.6 }}>
              Temperature로 <strong style={{ color: C.muted }}>나누면</strong> 점수 차이가 변합니다.
              {temperature < 1.0
                ? ' 낮추면 차이가 극대화되어 1위만 살아남습니다.'
                : temperature > 1.0
                  ? ' 높이면 차이가 줄어들어 여러 단어가 비슷해집니다.'
                  : ' 1.0이면 원래 점수 그대로입니다.'}
            </div>
          </div>

          {/* ── Switch Preset Button ── */}
          <button
            onClick={switchPreset}
            style={{
              width: '100%', padding: '12px 16px',
              borderRadius: 12, border: `1px solid rgba(99,102,241,0.25)`,
              background: 'rgba(99,102,241,0.08)',
              color: '#a5b4fc', fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(99,102,241,0.15)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(99,102,241,0.08)';
            }}
          >
            &#x1F504; 다른 문장 시도
          </button>

          {/* ── Preset indicator ── */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10,
          }}>
            {PRESETS.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setPresetIdx(i);
                  setUserGuess('');
                  setSubmitted(false);
                }}
                style={{
                  width: 8, height: 8, borderRadius: 99, border: 'none',
                  background: i === presetIdx ? C.violet : 'rgba(71,85,105,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                aria-label={`문장 ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Logit Table (collapsed) ─── */}
      <details style={{ marginTop: 16 }}>
        <summary style={{
          cursor: 'pointer', color: C.muted, fontSize: 12,
          padding: '8px 12px', borderRadius: 10,
          background: 'rgba(30,41,59,0.4)',
          border: `1px solid ${C.borderLight}`,
          userSelect: 'none',
        }}>
          &#x1F4CA; 로짓(logit) 원점수 보기
        </summary>
        <div style={{
          marginTop: 8, padding: '12px 14px',
          borderRadius: 12,
          background: C.card,
          border: `1px solid ${C.borderLight}`,
        }}>
          <div style={{
            fontSize: 11, color: C.dim, marginBottom: 8, lineHeight: 1.6,
          }}>
            로짓은 신경망이 각 단어에 매긴 <strong style={{ color: C.muted }}>원점수</strong>입니다.
            이 점수를 Temperature로 나눈 뒤 softmax를 적용하면 확률이 됩니다.
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 6,
          }}>
            {Object.entries(preset.logits)
              .sort((a, b) => b[1] - a[1])
              .map(([word, logit]) => (
                <div key={word} style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: 'rgba(15,23,42,0.5)',
                  border: `1px solid ${C.borderLight}`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{word}</div>
                  <div style={{ fontSize: 12, fontFamily: mono, color: C.amber, marginTop: 2 }}>
                    {logit.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 9, color: C.dim, marginTop: 1 }}>
                    /{temperature.toFixed(1)} = {(logit / temperature).toFixed(2)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </details>
    </div>
  );
}
