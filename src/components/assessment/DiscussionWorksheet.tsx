import { useState } from 'react';

interface Row {
  experiment: string;
  limitation: string;
  cause: string;
  lesson: string;
}

const initialRows: Row[] = [
  { experiment: '환각', limitation: '', cause: '', lesson: '4, 8차시' },
  { experiment: '산술', limitation: '', cause: '', lesson: '7차시' },
  { experiment: '논리', limitation: '', cause: '', lesson: '2, 8차시' },
  { experiment: '최신 정보', limitation: '', cause: '', lesson: '4, 8차시' },
  { experiment: '반복 함정', limitation: '', cause: '', lesson: '1, 4차시' },
];

const answerKey: Record<string, { limitation: string; cause: string }> = {
  '환각': {
    limitation: '존재하지 않는 정보를 그럴듯하게 생성',
    cause: '확률적 다음 토큰 예측 — 패턴만 따를 뿐, 사실 여부를 확인하지 않음',
  },
  '산술': {
    limitation: '큰 수 계산이나 글자 세기에서 오류',
    cause: '토큰 단위 처리 — 숫자/글자의 수학적 의미가 아닌 텍스트 패턴으로 처리',
  },
  '논리': {
    limitation: '복잡한 추론이나 형식 논리에서 오류',
    cause: '패턴 학습 기반 — 규칙을 적용하는 것이 아니라 유사 패턴의 결과를 예측',
  },
  '최신 정보': {
    limitation: '학습 이후 발생한 사건에 대해 모르거나 환각 생성',
    cause: '학습 데이터 범위의 한계 — 학습 시점 이후의 패턴은 존재하지 않음',
  },
  '반복 함정': {
    limitation: '잘못된 전제를 수용하고 그럴듯한 설명 생성',
    cause: '손실 최소화 ≠ 진실 파악 — "설명해줘" 패턴에 맞는 응답을 생성할 뿐',
  },
};

export default function DiscussionWorksheet() {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [showAnswers, setShowAnswers] = useState(false);

  const updateRow = (index: number, field: 'limitation' | 'cause', value: string) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const filledCount = rows.filter(r => r.limitation.trim() && r.cause.trim()).length;

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
        모둠 토의 워크시트
      </p>
      <p style={{
        color: '#94a3b8',
        fontSize: '13px',
        margin: '0 0 20px 0',
        textAlign: 'center',
      }}>
        5가지 실험 결과를 정리하고, 수업에서 배운 개념으로 구조적 원인을 설명하세요
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: '0 6px',
        }}>
          <thead>
            <tr>
              {['실험', 'AI가 보인 한계', '구조적 원인 (배운 개념 활용)', '연결 차시'].map(header => (
                <th key={header} style={{
                  color: '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'left',
                  padding: '4px 8px',
                  whiteSpace: 'nowrap',
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={{
                  background: 'rgba(167,139,250,0.08)',
                  borderRadius: '8px 0 0 8px',
                  padding: '10px 12px',
                  color: '#c4b5fd',
                  fontSize: '13px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  verticalAlign: 'top',
                }}>
                  {row.experiment}
                </td>
                <td style={{
                  background: 'rgba(0,0,0,0.2)',
                  padding: '6px',
                  verticalAlign: 'top',
                }}>
                  <textarea
                    value={row.limitation}
                    onChange={e => updateRow(i, 'limitation', e.target.value)}
                    placeholder="어떤 한계를 관찰했나요?"
                    style={{
                      width: '100%',
                      minHeight: '50px',
                      background: 'transparent',
                      border: '1px solid rgba(100,116,139,0.2)',
                      borderRadius: '6px',
                      color: '#e2e8f0',
                      padding: '8px',
                      fontSize: '12px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </td>
                <td style={{
                  background: 'rgba(0,0,0,0.2)',
                  padding: '6px',
                  verticalAlign: 'top',
                }}>
                  <textarea
                    value={row.cause}
                    onChange={e => updateRow(i, 'cause', e.target.value)}
                    placeholder="왜 이런 한계가 생기는 걸까요?"
                    style={{
                      width: '100%',
                      minHeight: '50px',
                      background: 'transparent',
                      border: '1px solid rgba(100,116,139,0.2)',
                      borderRadius: '6px',
                      color: '#e2e8f0',
                      padding: '8px',
                      fontSize: '12px',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </td>
                <td style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '0 8px 8px 0',
                  padding: '10px 12px',
                  color: '#94a3b8',
                  fontSize: '12px',
                  verticalAlign: 'top',
                  whiteSpace: 'nowrap',
                }}>
                  {row.lesson}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
      }}>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>
          작성 완료: {filledCount} / {rows.length}
        </span>
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          style={{
            padding: '8px 16px',
            background: showAnswers ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.15)',
            border: `1px solid ${showAnswers ? 'rgba(245,158,11,0.3)' : 'rgba(100,116,139,0.25)'}`,
            borderRadius: '8px',
            color: showAnswers ? '#fbbf24' : '#94a3b8',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {showAnswers ? '예시 답안 접기' : '예시 답안 보기'}
        </button>
      </div>

      {showAnswers && (
        <div style={{
          marginTop: '12px',
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '12px',
          padding: '16px',
        }}>
          <p style={{
            color: '#fbbf24',
            fontSize: '14px',
            fontWeight: 700,
            margin: '0 0 12px 0',
          }}>
            예시 답안
          </p>
          {Object.entries(answerKey).map(([name, answer]) => (
            <div key={name} style={{
              marginBottom: '10px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(245,158,11,0.1)',
            }}>
              <p style={{ color: '#fbbf24', fontSize: '13px', fontWeight: 600, margin: '0 0 4px 0' }}>
                {name}
              </p>
              <p style={{ color: '#e2e8f0', fontSize: '12px', margin: '0 0 2px 0', lineHeight: 1.5 }}>
                <span style={{ color: '#94a3b8' }}>한계:</span> {answer.limitation}
              </p>
              <p style={{ color: '#e2e8f0', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                <span style={{ color: '#94a3b8' }}>원인:</span> {answer.cause}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
