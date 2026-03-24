import { useState } from 'react';

const sampleBefore = [
  'AI는 프로그래밍된 대로만 하니까 생각이 아니다',
  'ChatGPT가 대화하는 건 생각하는 것 같다',
  '생각의 정의부터 내려야 답할 수 있다',
  'AI는 멍청해서 가끔 틀린다',
];

const conceptTags = [
  '튜링 테스트', '중국어 방', '퍼셉트론', '활성화함수', '손실함수',
  '경사하강법', '역전파', '토큰화', '임베딩', '어텐션', '확률적 예측',
  '학습 데이터', 'XOR', '비선형성',
];

export default function BeforeAfterReflection() {
  const [beforeText, setBeforeText] = useState('');
  const [afterText, setAfterText] = useState('');
  const [usedConcepts, setUsedConcepts] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggleConcept = (concept: string) => {
    setUsedConcepts(prev =>
      prev.includes(concept)
        ? prev.filter(c => c !== concept)
        : [...prev, concept]
    );
  };

  const handleSubmit = () => {
    if (afterText.trim().length > 0) {
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,32,48,0.95), rgba(20,22,36,0.98))',
      borderRadius: '16px',
      padding: '28px 24px',
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
        1차시의 나 vs 10차시의 나
      </p>
      <p style={{
        color: '#94a3b8',
        fontSize: '13px',
        margin: '0 0 20px 0',
        textAlign: 'center',
      }}>
        "기계가 생각할 수 있는가?" 에 대한 답이 어떻게 달라졌는지 비교합니다
      </p>

      {/* Before section */}
      <div style={{
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <p style={{
          color: '#fca5a5',
          fontSize: '14px',
          fontWeight: 700,
          margin: '0 0 8px 0',
        }}>
          Before: 1차시에 내가 쓴 답 (기억나는 대로 적어보세요)
        </p>
        <textarea
          value={beforeText}
          onChange={e => setBeforeText(e.target.value)}
          placeholder="1차시에 '기계가 생각할 수 있는가?'에 뭐라고 답했는지 떠올려보세요..."
          disabled={submitted}
          style={{
            width: '100%',
            minHeight: '80px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px',
            color: '#e2e8f0',
            padding: '12px',
            fontSize: '14px',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        <p style={{
          color: '#94a3b8',
          fontSize: '12px',
          margin: '8px 0 0 0',
        }}>
          1차시에 많이 나왔던 답 예시:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
          {sampleBefore.map((sample, i) => (
            <button
              key={i}
              onClick={() => !submitted && setBeforeText(sample)}
              disabled={submitted}
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '6px',
                color: '#fca5a5',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: submitted ? 'default' : 'pointer',
                opacity: submitted ? 0.5 : 1,
              }}
            >
              "{sample}"
            </button>
          ))}
        </div>
      </div>

      {/* After section */}
      <div style={{
        background: 'rgba(34,211,238,0.08)',
        border: '1px solid rgba(34,211,238,0.25)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <p style={{
          color: '#67e8f9',
          fontSize: '14px',
          fontWeight: 700,
          margin: '0 0 8px 0',
        }}>
          After: 10차시인 지금, 같은 질문에 다시 답합니다
        </p>
        <textarea
          value={afterText}
          onChange={e => setAfterText(e.target.value)}
          placeholder="이 수업에서 배운 개념을 3개 이상 포함하여 답해보세요..."
          disabled={submitted}
          style={{
            width: '100%',
            minHeight: '120px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(34,211,238,0.2)',
            borderRadius: '8px',
            color: '#e2e8f0',
            padding: '12px',
            fontSize: '14px',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />

        <p style={{
          color: '#94a3b8',
          fontSize: '12px',
          margin: '12px 0 6px 0',
        }}>
          답변에 사용한 개념을 선택하세요 (3개 이상):
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {conceptTags.map(tag => {
            const selected = usedConcepts.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => !submitted && toggleConcept(tag)}
                disabled={submitted}
                style={{
                  background: selected ? 'rgba(34,211,238,0.25)' : 'rgba(100,116,139,0.15)',
                  border: `1px solid ${selected ? 'rgba(34,211,238,0.5)' : 'rgba(100,116,139,0.25)'}`,
                  borderRadius: '6px',
                  color: selected ? '#67e8f9' : '#94a3b8',
                  padding: '4px 10px',
                  fontSize: '12px',
                  cursor: submitted ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
        {usedConcepts.length > 0 && usedConcepts.length < 3 && !submitted && (
          <p style={{ color: '#f59e0b', fontSize: '12px', margin: '8px 0 0 0' }}>
            {3 - usedConcepts.length}개 더 선택해주세요
          </p>
        )}
      </div>

      {/* Submit / Result */}
      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={afterText.trim().length === 0}
          style={{
            width: '100%',
            padding: '12px',
            background: afterText.trim().length > 0
              ? 'linear-gradient(135deg, #22d3ee, #a78bfa)'
              : 'rgba(100,116,139,0.2)',
            border: 'none',
            borderRadius: '8px',
            color: afterText.trim().length > 0 ? '#0f172a' : '#64748b',
            fontSize: '15px',
            fontWeight: 700,
            cursor: afterText.trim().length > 0 ? 'pointer' : 'default',
          }}
        >
          비교하기
        </button>
      ) : (
        <div style={{
          background: 'rgba(167,139,250,0.08)',
          border: '1px solid rgba(167,139,250,0.25)',
          borderRadius: '12px',
          padding: '16px',
        }}>
          <p style={{
            color: '#c4b5fd',
            fontSize: '15px',
            fontWeight: 700,
            margin: '0 0 12px 0',
            textAlign: 'center',
          }}>
            나의 변화
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 40px 1fr',
            gap: '12px',
            alignItems: 'start',
          }}>
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              borderRadius: '8px',
              padding: '12px',
            }}>
              <p style={{ color: '#fca5a5', fontSize: '12px', fontWeight: 700, margin: '0 0 6px 0' }}>
                1차시
              </p>
              <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                {beforeText || '(작성하지 않음)'}
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              paddingTop: '24px',
            }}>
              <span style={{ color: '#a78bfa', fontSize: '20px' }}>→</span>
            </div>

            <div style={{
              background: 'rgba(34,211,238,0.08)',
              borderRadius: '8px',
              padding: '12px',
            }}>
              <p style={{ color: '#67e8f9', fontSize: '12px', fontWeight: 700, margin: '0 0 6px 0' }}>
                10차시
              </p>
              <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                {afterText}
              </p>
            </div>
          </div>

          {usedConcepts.length > 0 && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 6px 0' }}>
                활용한 개념 ({usedConcepts.length}개):
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
                {usedConcepts.map(c => (
                  <span key={c} style={{
                    background: 'rgba(34,211,238,0.2)',
                    border: '1px solid rgba(34,211,238,0.3)',
                    borderRadius: '4px',
                    color: '#67e8f9',
                    padding: '2px 8px',
                    fontSize: '11px',
                  }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p style={{
            color: '#94a3b8',
            fontSize: '13px',
            margin: '16px 0 0 0',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            {usedConcepts.length >= 3
              ? '답의 근거가 구체적인 개념으로 뒷받침되고 있습니다. 이것이 8주간의 학습입니다.'
              : usedConcepts.length > 0
                ? '좋은 시작입니다. 개념을 더 활용하면 근거가 더 탄탄해집니다.'
                : '답변에 어떤 개념을 사용했는지 위에서 태그를 선택해보세요.'
            }
          </p>

          <button
            onClick={handleReset}
            style={{
              display: 'block',
              margin: '12px auto 0',
              padding: '8px 20px',
              background: 'rgba(100,116,139,0.15)',
              border: '1px solid rgba(100,116,139,0.25)',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            다시 작성하기
          </button>
        </div>
      )}
    </div>
  );
}
