import { useState, useCallback, useMemo } from 'react';

// ─── Color constants (same dark theme as PerceptronLearning) ───
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

// ─── Rainbow colors for token chips ───
const RAINBOW = [
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#84cc16', // lime
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // rose
  '#ec4899', // pink
  '#a855f7', // purple
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#22c55e', // green
  '#facc15', // amber
  '#fb923c', // tangerine
];

function getTokenColor(index: number): string {
  return RAINBOW[index % RAINBOW.length];
}

function getTokenBg(index: number): string {
  const color = RAINBOW[index % RAINBOW.length];
  return color + '20'; // 12% opacity
}

// ─── Simple tokenizer ───
// Korean common words that stay as single tokens
const KOREAN_COMMON_WORDS = [
  '안녕하세요', '감사합니다', '사랑', '학교', '선생님',
  '오늘', '내일', '어제', '우리', '나는', '너는',
  '점심', '저녁', '아침', '먹었', '했다', '입니다',
  '있다', '없다', '하다', '이다', '그리고', '하지만',
  '때문', '에서', '으로', '에게', '부터', '까지',
  '세요', '니다', '습니', '었어', '겠습',
];

// Longer Korean compound words to keep together
const KOREAN_COMPOUNDS = [
  '안녕하세요', '감사합니다', '고맙습니다', '사랑합니다',
  '먹었어', '갔어요', '했어요', '봤어요', '왔어요',
  '좋아요', '싫어요', '예쁘다', '맛있다',
];

interface Token {
  text: string;
  id: number;
  isSpecial?: boolean;
}

// Simple token vocabulary for stable IDs
const tokenIdMap = new Map<string, number>();
let nextTokenId = 100;

function getTokenId(text: string): number {
  const key = text.toLowerCase();
  if (tokenIdMap.has(key)) return tokenIdMap.get(key)!;
  const id = nextTokenId++;
  tokenIdMap.set(key, id);
  return id;
}

// Emoji detection
function isEmoji(char: string): boolean {
  const code = char.codePointAt(0);
  if (!code) return false;
  return (
    (code >= 0x1F600 && code <= 0x1F64F) || // Emoticons
    (code >= 0x1F300 && code <= 0x1F5FF) || // Misc Symbols
    (code >= 0x1F680 && code <= 0x1F6FF) || // Transport
    (code >= 0x1F1E0 && code <= 0x1F1FF) || // Flags
    (code >= 0x2600 && code <= 0x26FF) ||   // Misc symbols
    (code >= 0x2700 && code <= 0x27BF) ||   // Dingbats
    (code >= 0xFE00 && code <= 0xFE0F) ||   // Variation Selectors
    (code >= 0x1F900 && code <= 0x1F9FF) || // Supplemental Symbols
    (code >= 0x1FA00 && code <= 0x1FA6F) || // Chess Symbols
    (code >= 0x1FA70 && code <= 0x1FAFF) || // Symbols Extended-A
    (code >= 0x200D && code <= 0x200D) ||   // Zero Width Joiner
    (code >= 0x231A && code <= 0x231B) ||   // Watch/Hourglass
    (code >= 0x23E9 && code <= 0x23F3) ||   // Player buttons
    (code >= 0x23F8 && code <= 0x23FA) ||   // Recorder buttons
    (code >= 0x25AA && code <= 0x25AB) ||   // Squares
    (code >= 0x25B6 && code <= 0x25C0) ||   // Triangles
    (code >= 0x25FB && code <= 0x25FE) ||   // Squares
    (code >= 0x2934 && code <= 0x2935) ||   // Arrows
    (code >= 0x2B05 && code <= 0x2B07) ||   // Arrows
    (code >= 0x2B1B && code <= 0x2B1C) ||   // Squares
    (code >= 0x3030 && code <= 0x3030) ||   // Wavy dash
    (code >= 0x303D && code <= 0x303D) ||   // Part alternation mark
    (code >= 0x3297 && code <= 0x3297) ||   // Circled Ideograph Congratulation
    (code >= 0x3299 && code <= 0x3299)      // Circled Ideograph Secret
  );
}

function isKorean(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 0xAC00 && code <= 0xD7AF) || // Hangul Syllables
         (code >= 0x3131 && code <= 0x318E) || // Hangul Compatibility Jamo
         (code >= 0x1100 && code <= 0x11FF);   // Hangul Jamo
}

function isEnglishLetter(char: string): boolean {
  return /^[a-zA-Z]$/.test(char);
}

function tokenize(text: string): Token[] {
  if (!text.trim()) return [];

  const tokens: Token[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Skip leading space — but mark it as prefix for the next token
    let leadingSpace = '';
    if (remaining[0] === ' ') {
      leadingSpace = ' ';
      remaining = remaining.slice(1);
      if (remaining.length === 0) break;
    }

    // Try to match emoji (may be multi-codepoint)
    const emojiSegmenter = remaining.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u);
    if (emojiSegmenter) {
      const emoji = emojiSegmenter[0];
      tokens.push({ text: leadingSpace + emoji, id: getTokenId(emoji) });
      remaining = remaining.slice(emoji.length);
      continue;
    }

    // English word: collect contiguous letters as one token
    if (isEnglishLetter(remaining[0])) {
      let word = '';
      let i = 0;
      while (i < remaining.length && isEnglishLetter(remaining[i])) {
        word += remaining[i];
        i++;
      }
      tokens.push({ text: leadingSpace + word, id: getTokenId(word) });
      remaining = remaining.slice(i);
      continue;
    }

    // Korean: try to match known compound words first
    let matchedCompound = false;
    for (const compound of KOREAN_COMPOUNDS) {
      if (remaining.startsWith(compound)) {
        tokens.push({ text: leadingSpace + compound, id: getTokenId(compound) });
        remaining = remaining.slice(compound.length);
        matchedCompound = true;
        break;
      }
    }
    if (matchedCompound) continue;

    // Korean: try known 2-syllable words
    if (isKorean(remaining[0]) && remaining.length >= 2 && isKorean(remaining[1])) {
      const twoSyl = remaining.slice(0, 2);
      if (KOREAN_COMMON_WORDS.includes(twoSyl)) {
        tokens.push({ text: leadingSpace + twoSyl, id: getTokenId(twoSyl) });
        remaining = remaining.slice(2);
        continue;
      }
    }

    // Korean syllable: one character = one token (simulating subword BPE)
    if (isKorean(remaining[0])) {
      tokens.push({ text: leadingSpace + remaining[0], id: getTokenId(remaining[0]) });
      remaining = remaining.slice(1);
      continue;
    }

    // Numbers: collect contiguous digits
    if (/^\d/.test(remaining[0])) {
      let num = '';
      let i = 0;
      while (i < remaining.length && /\d/.test(remaining[i])) {
        num += remaining[i];
        i++;
      }
      tokens.push({ text: leadingSpace + num, id: getTokenId(num) });
      remaining = remaining.slice(i);
      continue;
    }

    // Punctuation: single character token
    tokens.push({ text: leadingSpace + remaining[0], id: getTokenId(remaining[0]) });
    remaining = remaining.slice(1);
  }

  return tokens;
}

// ─── Preset examples ───
interface Preset {
  label: string;
  text: string;
}

const PRESETS: Preset[] = [
  { label: '안녕하세요', text: '안녕하세요' },
  { label: 'Hello', text: 'Hello' },
  { label: '오늘 점심 뭐 먹었어?', text: '오늘 점심 뭐 먹었어?' },
  { label: 'What did you eat for lunch today?', text: 'What did you eat for lunch today?' },
  { label: 'AI는 정말 대단해! 😀', text: 'AI는 정말 대단해! 😀' },
];

// ─── Comparison pairs ───
interface ComparisonPair {
  label: string;
  ko: string;
  en: string;
}

const COMPARISON_PAIRS: ComparisonPair[] = [
  { label: '인사', ko: '안녕하세요', en: 'Hello' },
  { label: '점심 질문', ko: '오늘 점심 뭐 먹었어?', en: 'What did you eat for lunch today?' },
  { label: '감사', ko: '감사합니다', en: 'Thank you' },
  { label: '날씨', ko: '오늘 날씨가 좋다', en: 'The weather is nice today' },
];

// ─── Token Chip component ───
function TokenChip({
  token,
  index,
  showId,
}: {
  token: Token;
  index: number;
  showId: boolean;
}) {
  const color = getTokenColor(index);
  const bg = getTokenBg(index);

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        animation: 'tokenFadeIn 0.3s ease forwards',
        animationDelay: `${index * 60}ms`,
        opacity: 0,
      }}
    >
      {showId && (
        <span
          style={{
            fontSize: 9,
            fontFamily: mono,
            color: C.dim,
            letterSpacing: '0.02em',
          }}
        >
          {token.id}
        </span>
      )}
      <span
        style={{
          display: 'inline-block',
          padding: '5px 10px',
          borderRadius: 8,
          background: bg,
          border: `1.5px solid ${color}40`,
          color: color,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: mono,
          whiteSpace: 'pre',
          lineHeight: 1.3,
        }}
      >
        {token.text.replace(/ /g, '\u00B7')}
      </span>
    </div>
  );
}

// ─── Step indicator ───
function StepIndicator({
  step,
  total,
  active,
}: {
  step: number;
  total: number;
  active: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 10,
        background: active ? 'rgba(99,102,241,0.08)' : 'rgba(30,41,59,0.3)',
        border: `1px solid ${active ? 'rgba(99,102,241,0.25)' : C.borderLight}`,
        transition: 'all 0.3s',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: active ? '#fff' : C.dim,
          background: active
            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
            : 'rgba(51,65,85,0.5)',
          flexShrink: 0,
        }}
      >
        {step}
      </span>
      <span
        style={{
          fontSize: 12,
          color: active ? C.text : C.muted,
          fontWeight: active ? 600 : 400,
        }}
      >
        {step === 1 && '텍스트 입력'}
        {step === 2 && '토큰 분리'}
        {step === 3 && '토큰 ID 부여'}
      </span>
      {step < total && (
        <span style={{ color: C.dim, fontSize: 14, marginLeft: 'auto' }}>→</span>
      )}
    </div>
  );
}

// ─── Main Component ───
type TabMode = 'single' | 'compare';

export default function TokenizerPlayground() {
  const [input, setInput] = useState('');
  const [tabMode, setTabMode] = useState<TabMode>('single');
  const [selectedPair, setSelectedPair] = useState<number>(0);

  // Single mode tokens
  const tokens = useMemo(() => tokenize(input), [input]);

  // Compare mode tokens
  const pair = COMPARISON_PAIRS[selectedPair];
  const koTokens = useMemo(() => tokenize(pair.ko), [pair.ko]);
  const enTokens = useMemo(() => tokenize(pair.en), [pair.en]);

  const handlePreset = useCallback((text: string) => {
    setInput(text);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // tokens are already computed reactively
      }
    },
    []
  );

  const activeStep = input.length === 0 ? 1 : tokens.length > 0 ? 3 : 2;

  return (
    <div
      style={{
        background: `linear-gradient(145deg, ${C.bg}, rgba(10,15,30,0.98))`,
        borderRadius: 20,
        padding: '24px 20px',
        border: `1px solid ${C.border}`,
        maxWidth: 900,
        margin: '2rem auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* CSS animation for token fade-in */}
      <style>{`
        @keyframes tokenFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ─── Header ─── */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 99,
            padding: '4px 14px',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>Aa</span>
          <span
            style={{
              color: '#a5b4fc',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            토크나이저
          </span>
        </div>
        <h3
          style={{
            color: C.text,
            fontSize: 19,
            fontWeight: 700,
            margin: '4px 0 2px',
          }}
        >
          문장을 토큰으로 쪼개보기
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          문장을 입력하면 AI의 토크나이저가 어떻게 처리하는지 확인할 수 있습니다
        </p>
      </div>

      {/* ─── Tab Switcher ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 18,
        }}
      >
        {[
          { key: 'single' as TabMode, label: '자유 입력' },
          { key: 'compare' as TabMode, label: '한국어 / 영어 비교' },
        ].map(({ key, label }) => {
          const active = tabMode === key;
          return (
            <button
              key={key}
              onClick={() => setTabMode(key)}
              style={{
                padding: '9px 24px',
                borderRadius: 12,
                border: active
                  ? `2px solid ${C.violet}`
                  : `1px solid ${C.borderLight}`,
                background: active
                  ? 'rgba(139,92,246,0.12)'
                  : 'rgba(30,41,59,0.4)',
                color: active ? C.text : C.muted,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ─── Single Mode ─── */}
      {tabMode === 'single' && (
        <div>
          {/* Step indicators */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            {[1, 2, 3].map((step) => (
              <StepIndicator
                key={step}
                step={step}
                total={3}
                active={step <= activeStep}
              />
            ))}
          </div>

          {/* Input area */}
          <div
            style={{
              padding: '16px',
              borderRadius: 14,
              background: C.card,
              border: `1px solid ${C.borderLight}`,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                color: C.dim,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              1단계: 텍스트 입력
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="문장을 입력하세요 (예: 안녕하세요)"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: `1.5px solid ${
                  input.length > 0
                    ? 'rgba(99,102,241,0.4)'
                    : C.borderLight
                }`,
                background: 'rgba(15,23,42,0.7)',
                color: C.text,
                fontSize: 16,
                fontFamily: mono,
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
            />
            {/* Preset buttons */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginTop: 10,
              }}
            >
              <span
                style={{
                  color: C.dim,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  marginRight: 4,
                }}
              >
                예시:
              </span>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset.text)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: `1px solid ${C.borderLight}`,
                    background:
                      input === preset.text
                        ? 'rgba(99,102,241,0.15)'
                        : 'rgba(30,41,59,0.4)',
                    color: input === preset.text ? '#a5b4fc' : C.muted,
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tokenization result */}
          {tokens.length > 0 && (
            <>
              {/* Token chips */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 14,
                  background: C.card,
                  border: `1px solid ${C.borderLight}`,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      color: C.dim,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                    }}
                  >
                    2단계: 토큰 분리
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ color: C.dim, fontSize: 11 }}>
                      총 토큰 수:
                    </span>
                    <span
                      style={{
                        background:
                          'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 700,
                        padding: '2px 10px',
                        borderRadius: 8,
                        fontFamily: mono,
                      }}
                    >
                      {tokens.length}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'flex-end',
                  }}
                >
                  {tokens.map((token, i) => (
                    <TokenChip
                      key={`${token.text}-${i}`}
                      token={token}
                      index={i}
                      showId={false}
                    />
                  ))}
                </div>
              </div>

              {/* Token IDs */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 14,
                  background: C.card,
                  border: `1px solid ${C.borderLight}`,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    color: C.dim,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    marginBottom: 12,
                  }}
                >
                  3단계: 토큰 ID 부여 — AI가 실제로 받아들이는 숫자열
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'flex-start',
                  }}
                >
                  {tokens.map((token, i) => (
                    <TokenChip
                      key={`id-${token.text}-${i}`}
                      token={token}
                      index={i}
                      showId={true}
                    />
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(99,102,241,0.06)',
                    fontSize: 12,
                    color: C.muted,
                    lineHeight: 1.6,
                  }}
                >
                  AI에게 전달되는 숫자열:{' '}
                  <code
                    style={{
                      fontFamily: mono,
                      color: '#a5b4fc',
                      fontSize: 12,
                    }}
                  >
                    [{tokens.map((t) => t.id).join(', ')}]
                  </code>
                </div>
              </div>
            </>
          )}

          {/* Empty state prompt */}
          {tokens.length === 0 && (
            <div
              style={{
                padding: '24px 16px',
                borderRadius: 14,
                background: 'rgba(99,102,241,0.04)',
                border: `1px dashed rgba(99,102,241,0.2)`,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  color: C.muted,
                  fontSize: 13,
                  margin: 0,
                  lineHeight: 1.7,
                }}
              >
                위 입력창에 문장을 입력하면
                <br />
                토큰으로 분리된 결과가 여기에 표시됩니다
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── Compare Mode ─── */}
      {tabMode === 'compare' && (
        <div>
          {/* Pair selector */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 16,
              justifyContent: 'center',
            }}
          >
            {COMPARISON_PAIRS.map((p, i) => {
              const active = selectedPair === i;
              return (
                <button
                  key={p.label}
                  onClick={() => setSelectedPair(i)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 10,
                    border: active
                      ? `2px solid ${C.violet}`
                      : `1px solid ${C.borderLight}`,
                    background: active
                      ? 'rgba(139,92,246,0.12)'
                      : 'rgba(30,41,59,0.4)',
                    color: active ? C.text : C.muted,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Side by side comparison */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* Korean */}
            <div
              style={{
                flex: '1 1 280px',
                minWidth: 260,
                padding: '16px',
                borderRadius: 14,
                background: C.card,
                border: `1px solid ${C.borderLight}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      color: C.rose,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    KO
                  </span>
                  <span
                    style={{
                      color: C.text,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    한국어
                  </span>
                </div>
                <span
                  style={{
                    background:
                      'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: 8,
                    fontFamily: mono,
                  }}
                >
                  {koTokens.length}
                </span>
              </div>

              {/* Original text */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(15,23,42,0.5)',
                  marginBottom: 12,
                  fontSize: 15,
                  color: C.text,
                  fontFamily: mono,
                }}
              >
                {pair.ko}
              </div>

              {/* Tokens */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'flex-start',
                }}
              >
                {koTokens.map((token, i) => (
                  <TokenChip
                    key={`ko-${token.text}-${i}`}
                    token={token}
                    index={i}
                    showId={true}
                  />
                ))}
              </div>
            </div>

            {/* English */}
            <div
              style={{
                flex: '1 1 280px',
                minWidth: 260,
                padding: '16px',
                borderRadius: 14,
                background: C.card,
                border: `1px solid ${C.borderLight}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      background: 'rgba(59,130,246,0.15)',
                      color: C.blue,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    EN
                  </span>
                  <span
                    style={{
                      color: C.text,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    영어
                  </span>
                </div>
                <span
                  style={{
                    background:
                      'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: 8,
                    fontFamily: mono,
                  }}
                >
                  {enTokens.length}
                </span>
              </div>

              {/* Original text */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(15,23,42,0.5)',
                  marginBottom: 12,
                  fontSize: 15,
                  color: C.text,
                  fontFamily: mono,
                }}
              >
                {pair.en}
              </div>

              {/* Tokens */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'flex-start',
                }}
              >
                {enTokens.map((token, i) => (
                  <TokenChip
                    key={`en-${token.text}-${i}`}
                    token={token}
                    index={i}
                    showId={true}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Comparison insight */}
          <div
            style={{
              marginTop: 14,
              padding: '14px 16px',
              borderRadius: 12,
              background: 'rgba(99,102,241,0.06)',
              border: `1px solid rgba(99,102,241,0.15)`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {koTokens.length > enTokens.length ? '!' : '='}
              </span>
              <div>
                {koTokens.length > enTokens.length ? (
                  <p
                    style={{
                      color: C.text,
                      fontSize: 13,
                      margin: 0,
                      lineHeight: 1.7,
                    }}
                  >
                    <strong style={{ color: '#a5b4fc' }}>
                      같은 의미인데 한국어가 토큰 {koTokens.length - enTokens.length}개 더 많습니다.
                    </strong>
                    <br />
                    <span style={{ color: C.muted }}>
                      한국어({koTokens.length}개) vs 영어({enTokens.length}개). 현재 대부분의 AI가 영어 중심으로 학습되었기 때문에, 한국어 글자의 조합은 상대적으로 드물어서 토크나이저가 더 잘게 나눕니다. 같은 질문을 해도 한국어가 토큰을 더 많이 소모하므로, 비용이 더 들고 처리 속도도 느려질 수 있습니다.
                    </span>
                  </p>
                ) : koTokens.length === enTokens.length ? (
                  <p
                    style={{
                      color: C.text,
                      fontSize: 13,
                      margin: 0,
                      lineHeight: 1.7,
                    }}
                  >
                    <strong style={{ color: '#a5b4fc' }}>
                      이 예시에서는 토큰 수가 같습니다.
                    </strong>
                    <br />
                    <span style={{ color: C.muted }}>
                      한국어({koTokens.length}개) vs 영어({enTokens.length}개). 짧은 단어의 경우 토큰 수가 비슷할 수 있지만, 문장이 길어지면 대체로 한국어의 토큰이 더 많아집니다.
                    </span>
                  </p>
                ) : (
                  <p
                    style={{
                      color: C.text,
                      fontSize: 13,
                      margin: 0,
                      lineHeight: 1.7,
                    }}
                  >
                    <strong style={{ color: '#a5b4fc' }}>
                      이 예시에서는 영어 토큰이 더 많습니다.
                    </strong>
                    <br />
                    <span style={{ color: C.muted }}>
                      한국어({koTokens.length}개) vs 영어({enTokens.length}개). 드문 경우이지만, 영어 문장이 더 길거나 복합어가 많으면 역전될 수 있습니다.
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Visual bar chart comparison */}
            <div style={{ marginTop: 12 }}>
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
                    color: C.rose,
                    fontSize: 11,
                    fontWeight: 700,
                    width: 30,
                  }}
                >
                  KO
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 22,
                    borderRadius: 6,
                    background: 'rgba(15,23,42,0.5)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(
                        (koTokens.length /
                          Math.max(koTokens.length, enTokens.length)) *
                          100,
                        100
                      )}%`,
                      background:
                        'linear-gradient(90deg, rgba(239,68,68,0.3), rgba(239,68,68,0.6))',
                      borderRadius: 6,
                      transition: 'width 0.5s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 8,
                    }}
                  >
                    <span
                      style={{
                        color: '#fca5a5',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: mono,
                      }}
                    >
                      {koTokens.length}
                    </span>
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    color: C.blue,
                    fontSize: 11,
                    fontWeight: 700,
                    width: 30,
                  }}
                >
                  EN
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 22,
                    borderRadius: 6,
                    background: 'rgba(15,23,42,0.5)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(
                        (enTokens.length /
                          Math.max(koTokens.length, enTokens.length)) *
                          100,
                        100
                      )}%`,
                      background:
                        'linear-gradient(90deg, rgba(59,130,246,0.3), rgba(59,130,246,0.6))',
                      borderRadius: 6,
                      transition: 'width 0.5s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 8,
                    }}
                  >
                    <span
                      style={{
                        color: '#93c5fd',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: mono,
                      }}
                    >
                      {enTokens.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
