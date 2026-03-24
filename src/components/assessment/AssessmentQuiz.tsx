import { useState, useCallback } from 'react';

interface Question {
  id: number;
  type: 'fill' | 'calc' | 'choice';
  category: string;
  lesson: number;
  bloom: string;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  points: number;
}

const questions: Question[] = [
  // 1차시
  {
    id: 1, type: 'choice', category: '개념', lesson: 1, bloom: '기억',
    question: '1950년 앨런 튜링이 제안한 실험의 핵심은?',
    options: [
      '기계가 수학 문제를 풀 수 있는가',
      '사람과 구별할 수 없으면 생각한다고 볼 수 있는가',
      '기계가 체스를 이길 수 있는가',
      '기계가 감정을 느낄 수 있는가',
    ],
    answer: '사람과 구별할 수 없으면 생각한다고 볼 수 있는가',
    explanation: '튜링 테스트(모방 게임)는 심판이 사람과 기계를 구별할 수 없는지로 "생각"을 판단합니다.',
    points: 2,
  },
  {
    id: 2, type: 'fill', category: '개념', lesson: 1, bloom: '기억',
    question: '존 설(John Searle)의 "___" 사고실험은, 매뉴얼대로 답변하는 것은 이해가 아니라고 주장합니다.',
    answer: '중국어 방',
    explanation: '중국어 방(Chinese Room) 사고실험은 구문(syntax)을 따르는 것이 의미(semantics)를 이해하는 것과 다르다고 주장합니다.',
    points: 2,
  },
  // 2차시
  {
    id: 3, type: 'choice', category: '개념', lesson: 2, bloom: '이해',
    question: '단층 퍼셉트론이 풀 수 없는 문제는?',
    options: ['AND', 'OR', 'XOR', 'NOT'],
    answer: 'XOR',
    explanation: 'XOR은 직선 하나로 분리할 수 없는(선형 분리 불가능) 문제입니다.',
    points: 2,
  },
  {
    id: 4, type: 'calc', category: '계산', lesson: 2, bloom: '적용',
    question: '퍼셉트론: w₁=1, w₂=1, b=-1.5일 때, 입력 (1,1)의 가중합과 출력은? (가중합≥0이면 1)',
    answer: '0.5, 1',
    explanation: '가중합 = 1×1 + 1×1 + (-1.5) = 0.5. 0.5 ≥ 0이므로 출력 = 1.',
    points: 3,
  },
  // 3차시
  {
    id: 5, type: 'choice', category: '개념', lesson: 3, bloom: '이해',
    question: '활성화함수의 가장 핵심적인 역할은?',
    options: [
      '출력을 0과 1로 제한',
      '비선형성 도입',
      '가중치 초기화',
      '학습률 조절',
    ],
    answer: '비선형성 도입',
    explanation: '활성화함수가 없으면 층을 아무리 쌓아도 하나의 선형 변환과 같습니다. 비선형성이 있어야 XOR 같은 복잡한 문제를 풀 수 있습니다.',
    points: 2,
  },
  {
    id: 6, type: 'calc', category: '계산', lesson: 3, bloom: '적용',
    question: 'ReLU(3) = ?, ReLU(-2) = ?, Sigmoid(0) = ?',
    answer: '3, 0, 0.5',
    explanation: 'ReLU: 양수→그대로, 음수→0. Sigmoid(0) = 1/(1+e⁰) = 1/2 = 0.5.',
    points: 3,
  },
  // 4차시
  {
    id: 7, type: 'calc', category: '계산', lesson: 4, bloom: '적용',
    question: '모델 y=2x+1, 데이터 (1,4), (2,5), (3,8). MSE는? (소수점 둘째자리)',
    answer: '0.67',
    explanation: '예측: 3,5,7. 오차: -1,0,-1. 오차²: 1,0,1. MSE = (1+0+1)/3 ≈ 0.67',
    points: 3,
  },
  {
    id: 8, type: 'fill', category: '개념', lesson: 4, bloom: '이해',
    question: 'AI에서 "학습"이란 ___의 값을 최소화하는 과정입니다.',
    answer: '손실함수',
    explanation: '학습 = 손실함수(loss function) 최소화. 경사하강법과 역전파가 이 최소화를 수행합니다.',
    points: 2,
  },
  // 5차시
  {
    id: 9, type: 'calc', category: '계산', lesson: 5, bloom: '적용',
    question: '경사하강법: w=5.0, 기울기=-3, 학습률=0.1일 때 새 w는?',
    answer: '5.3',
    explanation: 'w_new = 5.0 - 0.1 × (-3) = 5.0 + 0.3 = 5.3',
    points: 3,
  },
  {
    id: 10, type: 'choice', category: '개념', lesson: 5, bloom: '이해',
    question: '학습률이 너무 크면 어떤 문제가 발생하는가?',
    options: [
      '학습이 너무 느려진다',
      '최솟값을 지나쳐 발산한다',
      '기울기가 소실된다',
      '로컬 미니마에 빠진다',
    ],
    answer: '최솟값을 지나쳐 발산한다',
    explanation: '학습률이 크면 한 걸음이 너무 커서 최솟값을 건너뛰고, 오히려 손실이 증가(발산)합니다.',
    points: 2,
  },
  // 6차시
  {
    id: 11, type: 'calc', category: '계산', lesson: 6, bloom: '적용',
    question: '순전파: x=1.0, w=0.3, b=0.1. 가중합 z = w×x + b = ?',
    answer: '0.4',
    explanation: 'z = 0.3 × 1.0 + 0.1 = 0.4',
    points: 2,
  },
  {
    id: 12, type: 'fill', category: '개념', lesson: 6, bloom: '기억',
    question: '역전파에서 사용하는 수학 원리는 합성함수의 미분 규칙인 ___입니다.',
    answer: '연쇄법칙',
    explanation: '연쇄법칙(chain rule): "전체 변화 = 각 단계 변화의 곱". 이를 통해 각 가중치의 기울기를 효율적으로 계산합니다.',
    points: 2,
  },
  {
    id: 13, type: 'calc', category: '계산', lesson: 6, bloom: '적용',
    question: 'Sigmoid 미분의 최댓값은 0.25입니다. 4층 신경망에서 기울기는 최대 몇 배로 줄어드나요?',
    answer: '0.0039',
    explanation: '0.25⁴ = 0.25 × 0.25 × 0.25 × 0.25 ≈ 0.0039 (약 1/256)',
    points: 3,
  },
  // 7차시
  {
    id: 14, type: 'calc', category: '계산', lesson: 7, bloom: '적용',
    question: '왕=[0.9,0.9,0.2], 남자=[0.2,0.9,0.1], 여자=[0.2,0.2,0.1]. "왕-남자+여자"의 결과는?',
    answer: '[0.9, 0.2, 0.2]',
    explanation: '[0.9-0.2+0.2, 0.9-0.9+0.2, 0.2-0.1+0.1] = [0.9, 0.2, 0.2] = 여왕의 벡터',
    points: 3,
  },
  {
    id: 15, type: 'fill', category: '개념', lesson: 7, bloom: '기억',
    question: '"비슷한 맥락에서 등장하는 단어는 비슷한 의미를 가진다"는 원리를 ___ 이라고 합니다.',
    answer: '분포 가설',
    explanation: '분포 가설(distributional hypothesis)은 Word2Vec 등 임베딩 학습의 기반 원리입니다.',
    points: 2,
  },
  // 8차시
  {
    id: 16, type: 'choice', category: '개념', lesson: 8, bloom: '이해',
    question: '어텐션 메커니즘이 RNN보다 뛰어난 핵심 이유는?',
    options: [
      '파라미터 수가 적다',
      '거리에 관계없이 관련 단어에 직접 주목할 수 있다',
      '학습 데이터가 적어도 된다',
      '환각이 발생하지 않는다',
    ],
    answer: '거리에 관계없이 관련 단어에 직접 주목할 수 있다',
    explanation: 'RNN은 순차 처리라 먼 단어의 영향이 약해지지만, 어텐션은 거리 무관하게 모든 단어에 직접 주목합니다.',
    points: 2,
  },
  {
    id: 17, type: 'fill', category: '개념', lesson: 8, bloom: '기억',
    question: 'AI가 존재하지 않는 정보를 그럴듯하게 생성하는 현상을 ___이라고 합니다.',
    answer: '환각',
    explanation: '환각(hallucination)은 다음 토큰 확률 예측 구조의 필연적 결과입니다.',
    points: 2,
  },
  // 9차시
  {
    id: 18, type: 'choice', category: '역사', lesson: 9, bloom: '기억',
    question: '역전파 논문(Rumelhart, Hinton, Williams)이 발표된 연도는?',
    options: ['1969', '1986', '2012', '2017'],
    answer: '1986',
    explanation: '1986년 Nature 저널에 발표되어 AI 겨울을 끝내는 데 기여했습니다.',
    points: 2,
  },
  // 10차시
  {
    id: 19, type: 'choice', category: '개념', lesson: 10, bloom: '분석',
    question: 'AI 산술 오류의 구조적 원인으로 가장 정확한 것은?',
    options: [
      'AI의 계산 능력이 부족해서',
      '학습 데이터에 수학 문제가 적어서',
      '숫자도 토큰 단위로 처리하기 때문에',
      'GPU 연산 오차 때문에',
    ],
    answer: '숫자도 토큰 단위로 처리하기 때문에',
    explanation: 'AI에게 숫자는 "의미"가 아니라 "텍스트 토큰"입니다. 7차시의 토큰화 개념과 연결됩니다.',
    points: 2,
  },
  {
    id: 20, type: 'fill', category: '종합', lesson: 10, bloom: '평가',
    question: '"AI는 멍청해서 틀린다"가 아니라 "이런 ___이기 때문에"라는 관점 전환이 이 수업의 핵심입니다.',
    answer: '구조',
    explanation: 'AI의 한계는 지능의 부족이 아니라, 확률적 예측이라는 구조의 필연적 결과입니다.',
    points: 2,
  },
];

function normalize(s: string): string {
  return s.replace(/\s+/g, '').replace(/[[\]]/g, '').toLowerCase();
}

export default function AssessmentQuiz() {
  const [currentQ, setCurrentQ] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState<Record<number, boolean>>({});
  const [mode, setMode] = useState<'quiz' | 'result'>('quiz');

  const q = questions[currentQ];

  const checkAnswer = useCallback((qId: number) => {
    setShowResult(prev => ({ ...prev, [qId]: true }));
  }, []);

  const isCorrect = (qId: number) => {
    const q = questions.find(x => x.id === qId);
    if (!q) return false;
    const ua = normalize(userAnswers[qId] || '');
    const ca = normalize(q.answer);
    if (q.type === 'choice') return ua === ca;
    // For fill/calc, check if answer contains the key parts
    return ca.split(',').every(part => ua.includes(normalize(part.trim())));
  };

  const totalScore = questions.reduce((sum, q) => {
    if (showResult[q.id] && isCorrect(q.id)) return sum + q.points;
    return sum;
  }, 0);
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
  const answeredCount = Object.keys(showResult).length;

  const goToResult = () => setMode('result');
  const resetQuiz = () => {
    setUserAnswers({});
    setShowResult({});
    setCurrentQ(0);
    setMode('quiz');
  };

  if (mode === 'result') {
    const lessonScores: Record<number, { earned: number; max: number }> = {};
    questions.forEach(q => {
      if (!lessonScores[q.lesson]) lessonScores[q.lesson] = { earned: 0, max: 0 };
      lessonScores[q.lesson].max += q.points;
      if (showResult[q.id] && isCorrect(q.id)) lessonScores[q.lesson].earned += q.points;
    });

    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(30,32,48,0.95), rgba(20,22,36,0.98))',
        borderRadius: '16px', padding: '28px 24px',
        border: '1px solid rgba(100,116,139,0.25)',
        maxWidth: '800px', margin: '1.5rem auto',
      }}>
        <p style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, textAlign: 'center', margin: '0 0 4px' }}>
          연습 결과
        </p>
        <p style={{
          color: totalScore / maxScore >= 0.8 ? '#22d3ee' : totalScore / maxScore >= 0.6 ? '#fbbf24' : '#fca5a5',
          fontSize: '36px', fontWeight: 700, textAlign: 'center', margin: '12px 0',
        }}>
          {totalScore} / {maxScore}점
        </p>
        <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', margin: '0 0 20px' }}>
          {totalScore / maxScore >= 0.8 ? '훌륭합니다! 핵심 개념을 잘 이해하고 있습니다.'
            : totalScore / maxScore >= 0.6 ? '좋은 출발입니다. 틀린 문제의 해설을 복습하세요.'
              : '교재를 다시 복습한 후 재도전해보세요.'}
        </p>

        <p style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: 600, margin: '0 0 8px' }}>차시별 성적</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
          {Object.entries(lessonScores).sort(([a], [b]) => Number(a) - Number(b)).map(([lesson, { earned, max }]) => {
            const pct = max > 0 ? earned / max : 0;
            return (
              <div key={lesson} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '12px', width: '50px', flexShrink: 0 }}>{lesson}차시</span>
                <div style={{ flex: 1, height: '8px', background: 'rgba(100,116,139,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct * 100}%`, height: '100%', borderRadius: '4px',
                    background: pct >= 0.8 ? '#22d3ee' : pct >= 0.5 ? '#fbbf24' : '#ef4444',
                    transition: 'width 0.5s',
                  }} />
                </div>
                <span style={{ color: '#e2e8f0', fontSize: '12px', width: '50px', textAlign: 'right' }}>
                  {earned}/{max}
                </span>
              </div>
            );
          })}
        </div>

        <p style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: 600, margin: '0 0 8px' }}>오답 복습</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {questions.filter(q => showResult[q.id] && !isCorrect(q.id)).map(q => (
            <div key={q.id} style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px', padding: '12px',
            }}>
              <p style={{ color: '#fca5a5', fontSize: '12px', margin: '0 0 4px' }}>{q.lesson}차시 | {q.category}</p>
              <p style={{ color: '#e2e8f0', fontSize: '13px', margin: '0 0 6px', lineHeight: 1.5 }}>{q.question}</p>
              <p style={{ color: '#22d3ee', fontSize: '12px', margin: 0 }}>정답: {q.answer}</p>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0', lineHeight: 1.5 }}>{q.explanation}</p>
            </div>
          ))}
          {questions.filter(q => showResult[q.id] && !isCorrect(q.id)).length === 0 && (
            <p style={{ color: '#22d3ee', fontSize: '13px' }}>모두 정답입니다!</p>
          )}
        </div>

        <button onClick={resetQuiz} style={{
          width: '100%', padding: '12px',
          background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
          border: 'none', borderRadius: '8px',
          color: '#0f172a', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
        }}>
          다시 풀기
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,32,48,0.95), rgba(20,22,36,0.98))',
      borderRadius: '16px', padding: '24px',
      border: '1px solid rgba(100,116,139,0.25)',
      maxWidth: '800px', margin: '1.5rem auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 700, margin: 0 }}>
          평가 연습
        </p>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>
          {answeredCount}/{questions.length}문항 · {totalScore}점
        </span>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '16px' }}>
        {questions.map((_, i) => (
          <div key={i} onClick={() => setCurrentQ(i)} style={{
            flex: 1, height: '6px', borderRadius: '3px', cursor: 'pointer',
            background: showResult[questions[i].id]
              ? isCorrect(questions[i].id) ? '#22d3ee' : '#ef4444'
              : i === currentQ ? 'rgba(167,139,250,0.5)' : 'rgba(100,116,139,0.2)',
          }} />
        ))}
      </div>

      {/* Question */}
      <div style={{
        background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '20px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{
            background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
            borderRadius: '4px', padding: '2px 8px', color: '#c4b5fd', fontSize: '11px',
          }}>{q.lesson}차시</span>
          <span style={{
            background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)',
            borderRadius: '4px', padding: '2px 8px', color: '#67e8f9', fontSize: '11px',
          }}>{q.category}</span>
          <span style={{
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: '4px', padding: '2px 8px', color: '#fbbf24', fontSize: '11px',
          }}>{q.bloom}</span>
          <span style={{
            background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.25)',
            borderRadius: '4px', padding: '2px 8px', color: '#94a3b8', fontSize: '11px',
          }}>{q.points}점</span>
        </div>

        <p style={{ color: '#e2e8f0', fontSize: '15px', margin: '0 0 16px', lineHeight: 1.6 }}>
          <strong>Q{q.id}.</strong> {q.question}
        </p>

        {q.type === 'choice' && q.options ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {q.options.map((opt, i) => {
              const selected = userAnswers[q.id] === opt;
              const revealed = showResult[q.id];
              const correct = opt === q.answer;
              return (
                <button key={i} onClick={() => !revealed && setUserAnswers({ ...userAnswers, [q.id]: opt })}
                  disabled={!!revealed}
                  style={{
                    padding: '10px 14px', textAlign: 'left',
                    background: revealed
                      ? correct ? 'rgba(34,211,238,0.12)' : selected ? 'rgba(239,68,68,0.12)' : 'rgba(0,0,0,0.15)'
                      : selected ? 'rgba(167,139,250,0.15)' : 'rgba(0,0,0,0.15)',
                    border: `1px solid ${revealed
                      ? correct ? 'rgba(34,211,238,0.4)' : selected ? 'rgba(239,68,68,0.4)' : 'rgba(100,116,139,0.15)'
                      : selected ? 'rgba(167,139,250,0.4)' : 'rgba(100,116,139,0.15)'}`,
                    borderRadius: '8px',
                    color: revealed
                      ? correct ? '#67e8f9' : selected ? '#fca5a5' : '#94a3b8'
                      : selected ? '#c4b5fd' : '#e2e8f0',
                    fontSize: '13px', cursor: revealed ? 'default' : 'pointer',
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            type="text"
            value={userAnswers[q.id] || ''}
            onChange={e => !showResult[q.id] && setUserAnswers({ ...userAnswers, [q.id]: e.target.value })}
            disabled={!!showResult[q.id]}
            placeholder={q.type === 'calc' ? '계산 결과를 입력하세요' : '답을 입력하세요'}
            style={{
              width: '100%', padding: '12px',
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${showResult[q.id]
                ? isCorrect(q.id) ? 'rgba(34,211,238,0.4)' : 'rgba(239,68,68,0.4)'
                : 'rgba(100,116,139,0.25)'}`,
              borderRadius: '8px', color: '#e2e8f0', fontSize: '14px',
              boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        )}

        {showResult[q.id] && (
          <div style={{
            marginTop: '12px', padding: '12px', borderRadius: '8px',
            background: isCorrect(q.id) ? 'rgba(34,211,238,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${isCorrect(q.id) ? 'rgba(34,211,238,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <p style={{
              color: isCorrect(q.id) ? '#67e8f9' : '#fca5a5',
              fontSize: '13px', fontWeight: 700, margin: '0 0 4px',
            }}>
              {isCorrect(q.id) ? '정답!' : `오답 — 정답: ${q.answer}`}
            </p>
            <p style={{ color: '#e2e8f0', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
              {q.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          style={{
            padding: '10px 16px', background: 'rgba(100,116,139,0.15)',
            border: '1px solid rgba(100,116,139,0.25)', borderRadius: '8px',
            color: currentQ === 0 ? '#475569' : '#94a3b8', fontSize: '13px', cursor: currentQ === 0 ? 'default' : 'pointer',
          }}>
          이전
        </button>

        {!showResult[q.id] ? (
          <button onClick={() => checkAnswer(q.id)}
            disabled={!userAnswers[q.id]}
            style={{
              flex: 1, padding: '10px',
              background: userAnswers[q.id] ? 'linear-gradient(135deg, #22d3ee, #a78bfa)' : 'rgba(100,116,139,0.2)',
              border: 'none', borderRadius: '8px',
              color: userAnswers[q.id] ? '#0f172a' : '#64748b',
              fontSize: '14px', fontWeight: 700, cursor: userAnswers[q.id] ? 'pointer' : 'default',
            }}>
            확인
          </button>
        ) : (
          <button onClick={() => {
            if (currentQ < questions.length - 1) setCurrentQ(currentQ + 1);
            else goToResult();
          }}
            style={{
              flex: 1, padding: '10px',
              background: currentQ === questions.length - 1
                ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                : 'rgba(34,211,238,0.15)',
              border: currentQ === questions.length - 1 ? 'none' : '1px solid rgba(34,211,238,0.3)',
              borderRadius: '8px',
              color: currentQ === questions.length - 1 ? '#0f172a' : '#67e8f9',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}>
            {currentQ === questions.length - 1 ? '결과 보기' : '다음'}
          </button>
        )}

        <button onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
          disabled={currentQ === questions.length - 1}
          style={{
            padding: '10px 16px', background: 'rgba(100,116,139,0.15)',
            border: '1px solid rgba(100,116,139,0.25)', borderRadius: '8px',
            color: currentQ === questions.length - 1 ? '#475569' : '#94a3b8',
            fontSize: '13px', cursor: currentQ === questions.length - 1 ? 'default' : 'pointer',
          }}>
          다음
        </button>
      </div>
    </div>
  );
}
