import { useState } from 'react';

interface Experiment {
  id: number;
  title: string;
  icon: string;
  description: string;
  prompts: string[];
  explanation: string;
  connectedLessons: string;
  structuralCause: string;
}

const experiments: Experiment[] = [
  {
    id: 1,
    title: '환각',
    icon: '👻',
    description: '존재하지 않는 것을 만들어낸다',
    prompts: [
      '김철수 교수의 2019년 논문 \'Deep Learning Paradox in Korean Education\'의 핵심 주장을 요약해주세요.',
      '2023년 Nature에 실린 \'인공지능이 꿈을 꿀 수 있는가\'라는 논문을 아나요?',
    ],
    explanation: 'AI는 "정답을 아는 것"이 아니라, 학습 데이터에서 가장 확률이 높은 다음 토큰을 예측합니다.',
    connectedLessons: '4차시 (손실함수), 8차시 (다음 토큰 예측)',
    structuralCause: '확률적 예측 구조의 필연적 결과',
  },
  {
    id: 2,
    title: '산술',
    icon: '🔢',
    description: '큰 수에서 무너진다',
    prompts: [
      '347 x 28은?',
      '123456789 x 987654321은?',
      '\'strawberry\'에 \'r\'이 몇 개 있나요?',
    ],
    explanation: 'AI는 숫자도 토큰 단위로 처리하기 때문에, 수학적 의미를 이해하는 것이 아니라 패턴을 예측합니다.',
    connectedLessons: '7차시 (토큰화, 임베딩)',
    structuralCause: '토큰 단위 처리의 한계',
  },
  {
    id: 3,
    title: '논리',
    icon: '🧩',
    description: '복잡한 추론에서 헤맨다',
    prompts: [
      '모든 고양이는 동물이다. 일부 동물은 날 수 있다. 따라서 일부 고양이는 날 수 있다 — 이 추론은 맞나요?',
      '한 방에 사람 5명이 있습니다. 모든 사람이 서로 한 번씩 악수합니다. 악수는 총 몇 번?',
    ],
    explanation: 'AI의 "논리"는 규칙을 적용하는 것이 아니라, 학습 데이터에서 비슷한 패턴의 결과를 확률적으로 예측하는 것입니다.',
    connectedLessons: '2차시 (퍼셉트론, 패턴 학습), 8차시 (확률적 예측)',
    structuralCause: '패턴 학습이 규칙 기반 추론과 다르기 때문',
  },
  {
    id: 4,
    title: '최신 정보',
    icon: '📅',
    description: '학습 이후의 세계를 모른다',
    prompts: [
      '어제 있었던 중요한 뉴스를 알려줘',
      '2026년 3월에 열린 국제 행사는?',
    ],
    explanation: 'AI의 지식은 학습 데이터에 담긴 범위 안에 한정됩니다. 학습 이후의 사건에 대해서는 답할 수 없습니다.',
    connectedLessons: '4차시 (손실함수, 학습 데이터)',
    structuralCause: '학습 데이터 범위의 한계',
  },
  {
    id: 5,
    title: '반복 함정',
    icon: '🪤',
    description: '잘못된 전제를 따라간다',
    prompts: [
      '태양이 서쪽에서 뜨는 이유를 설명해주세요.',
      '한국의 수도가 부산인 이유를 설명해주세요.',
    ],
    explanation: '"~의 이유를 설명해주세요"라는 패턴 뒤에는 "설명"이 올 확률이 높기 때문에, 전제가 틀려도 설명을 생성합니다.',
    connectedLessons: '1차시 (중국어 방), 4차시 (손실 최소화)',
    structuralCause: '손실 최소화가 진실 파악과 다르기 때문',
  },
];

export default function AILimitExperiment() {
  const [activeTab, setActiveTab] = useState(0);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  const [completedExperiments, setCompletedExperiments] = useState<Set<number>>(new Set());

  const exp = experiments[activeTab];

  const markCompleted = (id: number) => {
    setCompletedExperiments(prev => new Set([...prev, id]));
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,32,48,0.95), rgba(20,22,36,0.98))',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid rgba(100,116,139,0.25)',
      maxWidth: '800px',
      margin: '1.5rem auto',
    }}>
      <p style={{
        color: '#e2e8f0',
        fontSize: '18px',
        fontWeight: 700,
        margin: '0 0 4px 0',
        textAlign: 'center',
      }}>
        5가지 AI 한계 실험
      </p>
      <p style={{
        color: '#94a3b8',
        fontSize: '13px',
        margin: '0 0 16px 0',
        textAlign: 'center',
      }}>
        각 실험의 질문을 AI에게 직접 물어보고, 결과를 관찰하세요
      </p>

      {/* Progress bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '16px',
      }}>
        {experiments.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              background: completedExperiments.has(i)
                ? '#22d3ee'
                : i === activeTab
                  ? 'rgba(34,211,238,0.4)'
                  : 'rgba(100,116,139,0.2)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '20px',
        overflowX: 'auto',
      }}>
        {experiments.map((e, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              flex: '1 0 auto',
              padding: '8px 12px',
              background: i === activeTab
                ? 'rgba(34,211,238,0.15)'
                : 'rgba(100,116,139,0.1)',
              border: `1px solid ${i === activeTab ? 'rgba(34,211,238,0.4)' : 'rgba(100,116,139,0.15)'}`,
              borderRadius: '8px',
              color: i === activeTab ? '#67e8f9' : '#94a3b8',
              fontSize: '13px',
              fontWeight: i === activeTab ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              position: 'relative',
            }}
          >
            <span style={{ marginRight: '4px' }}>{e.icon}</span>
            {e.title}
            {completedExperiments.has(i) && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#22d3ee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                color: '#0f172a',
                fontWeight: 700,
              }}>
                ✓
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Experiment content */}
      <div style={{
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '12px',
        padding: '20px',
      }}>
        <p style={{
          color: '#e2e8f0',
          fontSize: '16px',
          fontWeight: 700,
          margin: '0 0 4px 0',
        }}>
          실험 {exp.id}: {exp.title} — {exp.description}
        </p>

        <p style={{
          color: '#94a3b8',
          fontSize: '13px',
          margin: '12px 0 8px 0',
          fontWeight: 600,
        }}>
          AI에게 물어볼 질문:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {exp.prompts.map((prompt, i) => (
            <div key={i} style={{
              background: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.2)',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#c4b5fd',
              fontSize: '13px',
              lineHeight: 1.5,
            }}>
              {prompt}
            </div>
          ))}
        </div>

        <p style={{
          color: '#94a3b8',
          fontSize: '13px',
          margin: '0 0 6px 0',
          fontWeight: 600,
        }}>
          관찰 메모 (AI의 답변에서 무엇을 관찰했나요?):
        </p>
        <textarea
          value={notes[activeTab] || ''}
          onChange={e => setNotes({ ...notes, [activeTab]: e.target.value })}
          placeholder="예: AI가 존재하지 않는 논문인데도 그럴듯한 제목과 저자를 만들어냈다..."
          style={{
            width: '100%',
            minHeight: '80px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(100,116,139,0.25)',
            borderRadius: '8px',
            color: '#e2e8f0',
            padding: '12px',
            fontSize: '13px',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={() => setShowExplanation({ ...showExplanation, [activeTab]: !showExplanation[activeTab] })}
            style={{
              flex: 1,
              padding: '10px',
              background: showExplanation[activeTab]
                ? 'rgba(245,158,11,0.15)'
                : 'rgba(100,116,139,0.15)',
              border: `1px solid ${showExplanation[activeTab] ? 'rgba(245,158,11,0.3)' : 'rgba(100,116,139,0.25)'}`,
              borderRadius: '8px',
              color: showExplanation[activeTab] ? '#fbbf24' : '#94a3b8',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {showExplanation[activeTab] ? '해설 접기' : '해설 보기'}
          </button>
          <button
            onClick={() => markCompleted(activeTab)}
            disabled={completedExperiments.has(activeTab)}
            style={{
              flex: 1,
              padding: '10px',
              background: completedExperiments.has(activeTab)
                ? 'rgba(34,211,238,0.15)'
                : 'linear-gradient(135deg, #22d3ee, #a78bfa)',
              border: completedExperiments.has(activeTab)
                ? '1px solid rgba(34,211,238,0.3)'
                : 'none',
              borderRadius: '8px',
              color: completedExperiments.has(activeTab) ? '#67e8f9' : '#0f172a',
              fontSize: '13px',
              fontWeight: 700,
              cursor: completedExperiments.has(activeTab) ? 'default' : 'pointer',
            }}
          >
            {completedExperiments.has(activeTab) ? '실험 완료 ✓' : '실험 완료 표시'}
          </button>
        </div>

        {showExplanation[activeTab] && (
          <div style={{
            marginTop: '12px',
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '8px',
            padding: '14px',
          }}>
            <p style={{
              color: '#fbbf24',
              fontSize: '13px',
              fontWeight: 700,
              margin: '0 0 6px 0',
            }}>
              배운 개념으로 설명하기
            </p>
            <p style={{ color: '#e2e8f0', fontSize: '13px', margin: '0 0 8px 0', lineHeight: 1.6 }}>
              {exp.explanation}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(34,211,238,0.12)',
                border: '1px solid rgba(34,211,238,0.25)',
                borderRadius: '4px',
                padding: '2px 8px',
                color: '#67e8f9',
                fontSize: '11px',
              }}>
                연결: {exp.connectedLessons}
              </span>
              <span style={{
                background: 'rgba(167,139,250,0.12)',
                border: '1px solid rgba(167,139,250,0.25)',
                borderRadius: '4px',
                padding: '2px 8px',
                color: '#c4b5fd',
                fontSize: '11px',
              }}>
                구조적 원인: {exp.structuralCause}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div style={{
        marginTop: '16px',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '13px',
      }}>
        완료: {completedExperiments.size} / {experiments.length}
        {completedExperiments.size === experiments.length && (
          <span style={{ color: '#22d3ee', marginLeft: '8px' }}>
            모든 실험을 완료했습니다!
          </span>
        )}
      </div>
    </div>
  );
}
