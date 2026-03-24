import { useState } from 'react';

const landmarks = [
  { pos: 10, label: 'ELIZA (1966)', desc: '패턴 매칭으로 대화를 흉내냄' },
  { pos: 30, label: '시리 / 구글 번역', desc: '특정 작업을 잘 수행하지만 범용적이지 않음' },
  { pos: 45, label: 'ChatGPT (2022~)', desc: '자연어 생성, 맥락 파악, 추론 시도' },
  { pos: 70, label: '영화 〈그녀〉 속 AI', desc: '감정을 느끼고, 스스로 관계를 형성' },
  { pos: 90, label: '인간 수준의 의식', desc: '자아 인식, 주관적 경험, 자유의지' },
];

// 5단계 구간: 각 구간의 의미를 명확하게
const getZoneInfo = (v: number) => {
  if (v < 20) return {
    label: '규칙 기반 반응',
    desc: '정해진 규칙을 따를 뿐, 이해와는 거리가 멀다',
    color: '#10b981',
  };
  if (v < 40) return {
    label: '패턴 인식 수준',
    desc: '통계적 패턴을 학습했지만, 의미를 파악하지는 못한다',
    color: '#22d3ee',
  };
  if (v < 60) return {
    label: '논쟁의 한가운데',
    desc: '행동은 지능적이지만, "이해"하는 것인지 "흉내"인지 의견이 갈린다',
    color: '#a78bfa',
  };
  if (v < 80) return {
    label: '이해에 근접?',
    desc: '단순한 패턴 매칭을 넘어선 무언가가 있다는 주장이 가능한 영역',
    color: '#f59e0b',
  };
  return {
    label: '의식을 가진 존재',
    desc: '주관적 경험과 자아 인식이 있다 — 현재 어떤 AI도 여기에 있다고 합의되지 않았다',
    color: '#ef4444',
  };
};

export default function AISpectrumSlider() {
  const [value, setValue] = useState(45);
  const [showResult, setShowResult] = useState(false);

  const zone = getZoneInfo(value);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,32,48,0.95), rgba(20,22,36,0.98))',
      borderRadius: '16px',
      padding: '28px 24px',
      border: '1px solid rgba(100,116,139,0.25)',
      maxWidth: '720px',
      margin: '1.5rem auto',
    }}>
      <p style={{
        color: '#e2e8f0',
        fontSize: '16px',
        fontWeight: 700,
        margin: '0 0 6px 0',
        textAlign: 'center',
      }}>
        여러분의 생각은?
      </p>
      <p style={{
        color: '#94a3b8',
        fontSize: '13px',
        margin: '0 0 20px 0',
        textAlign: 'center',
      }}>
        "현재 AI(예: ChatGPT)는 이 스펙트럼에서 어디쯤에 있다고 생각하나요?"
      </p>

      {/* Spectrum bar labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        padding: '0 4px',
      }}>
        <span style={{ color: '#6ee7b7', fontSize: '13px', fontWeight: 600 }}>
          약한 AI — 흉내만 낸다
        </span>
        <span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 600 }}>
          강한 AI — 진짜 이해한다
        </span>
      </div>

      {/* Gradient bar */}
      <div style={{
        position: 'relative',
        height: '12px',
        borderRadius: '6px',
        background: 'linear-gradient(to right, #10b981, #22d3ee, #a78bfa, #f59e0b, #ef4444)',
        marginBottom: '8px',
        opacity: 0.7,
      }} />

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => {
          setValue(Number(e.target.value));
          setShowResult(false);
        }}
        style={{
          width: '100%',
          margin: '0 0 16px 0',
          accentColor: zone.color,
          cursor: 'pointer',
        }}
      />

      {/* Landmark buttons */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        justifyContent: 'center',
        marginBottom: '16px',
      }}>
        {landmarks.map((lm) => (
          <button
            key={lm.label}
            onClick={() => { setValue(lm.pos); setShowResult(false); }}
            title={lm.desc}
            style={{
              background: Math.abs(value - lm.pos) < 8
                ? 'rgba(99,102,241,0.3)'
                : 'rgba(51,65,85,0.4)',
              border: Math.abs(value - lm.pos) < 8
                ? '1px solid rgba(129,140,248,0.6)'
                : '1px solid rgba(71,85,105,0.4)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#cbd5e1',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {lm.label}
          </button>
        ))}
      </div>

      {/* Current position display */}
      <div style={{
        textAlign: 'center',
        padding: '14px 16px',
        background: 'rgba(30,41,59,0.6)',
        borderRadius: '10px',
        marginBottom: '14px',
      }}>
        <span style={{
          color: zone.color,
          fontSize: '20px',
          fontWeight: 700,
        }}>
          {zone.label}
        </span>
        <p style={{
          color: '#cbd5e1',
          fontSize: '13px',
          margin: '6px 0 0 0',
          lineHeight: '1.5',
        }}>
          {zone.desc}
        </p>
      </div>

      {/* Submit button */}
      <button
        onClick={() => setShowResult(true)}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px',
          background: showResult
            ? 'rgba(16,185,129,0.2)'
            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: showResult
            ? '1px solid rgba(16,185,129,0.4)'
            : 'none',
          borderRadius: '10px',
          color: '#e2e8f0',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.3s',
        }}
      >
        {showResult ? '✓ 기록됨!' : '내 생각 기록하기'}
      </button>

      {showResult && (
        <p style={{
          color: '#94a3b8',
          fontSize: '12px',
          textAlign: 'center',
          margin: '10px 0 0 0',
        }}>
          정답은 없습니다. 10차시에서 같은 질문을 다시 해볼 거예요. 그때 여러분의 생각이 어떻게 바뀌었을까요?
        </p>
      )}
    </div>
  );
}
