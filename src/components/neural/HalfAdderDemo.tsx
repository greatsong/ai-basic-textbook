import { useState } from 'react';

const cases = [
  { a: 0, b: 0 },
  { a: 0, b: 1 },
  { a: 1, b: 0 },
  { a: 1, b: 1 },
];

export default function HalfAdderDemo() {
  const [selected, setSelected] = useState(0);
  const { a, b } = cases[selected];

  // Gate computations
  const aOrB = a | b;
  const aAndB = a & b;
  const notAAndB = aAndB ? 0 : 1;
  const xorResult = aOrB & notAAndB; // (A OR B) AND NOT(A AND B) = XOR
  const carry = aAndB;

  const hi = '#6ee7b7';
  const lo = '#475569';
  const active = (v: number) => v ? hi : lo;
  const label = (v: number) => v ? '1' : '0';

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,32,48,0.95), rgba(20,22,36,0.98))',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid rgba(100,116,139,0.25)',
      maxWidth: '720px',
      margin: '1.5rem auto',
    }}>
      <p style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: 700, margin: '0 0 4px', textAlign: 'center' }}>
        반가산기 체험
      </p>
      <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 16px', textAlign: 'center' }}>
        입력을 선택하면 AND, OR, NOT 게이트가 어떻게 동작하는지 확인하세요
      </p>

      {/* Input selector buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
        {cases.map((c, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: selected === i ? '2px solid #6366f1' : '1px solid rgba(71,85,105,0.5)',
              background: selected === i ? 'rgba(99,102,241,0.2)' : 'rgba(30,41,59,0.6)',
              color: '#e2e8f0',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            A={c.a}, B={c.b}
          </button>
        ))}
      </div>

      {/* Circuit visualization */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '12px',
      }}>
        {/* Step 1: Individual gates */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '10px',
        }}>
          {/* OR gate */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center',
            border: `1px solid ${active(aOrB)}`,
            transition: 'all 0.3s',
          }}>
            <p style={{ color: '#93c5fd', fontSize: '13px', margin: '0 0 6px', fontWeight: 600 }}>① OR 게이트</p>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px' }}>
              {a} OR {b}
            </p>
            <p style={{
              color: active(aOrB),
              fontSize: '28px',
              fontWeight: 700,
              margin: 0,
              transition: 'all 0.3s',
            }}>
              {label(aOrB)}
            </p>
            <p style={{ color: '#64748b', fontSize: '11px', margin: '4px 0 0' }}>
              하나라도 1이면 1
            </p>
          </div>

          {/* AND gate */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center',
            border: `1px solid ${active(aAndB)}`,
            transition: 'all 0.3s',
          }}>
            <p style={{ color: '#6ee7b7', fontSize: '13px', margin: '0 0 6px', fontWeight: 600 }}>② AND 게이트</p>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px' }}>
              {a} AND {b}
            </p>
            <p style={{
              color: active(aAndB),
              fontSize: '28px',
              fontWeight: 700,
              margin: 0,
              transition: 'all 0.3s',
            }}>
              {label(aAndB)}
            </p>
            <p style={{ color: '#64748b', fontSize: '11px', margin: '4px 0 0' }}>
              둘 다 1일 때만 1
            </p>
          </div>

          {/* NOT gate */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            borderRadius: '12px',
            padding: '14px',
            textAlign: 'center',
            border: `1px solid ${active(notAAndB)}`,
            transition: 'all 0.3s',
          }}>
            <p style={{ color: '#fca5a5', fontSize: '13px', margin: '0 0 6px', fontWeight: 600 }}>③ NOT(②)</p>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px' }}>
              NOT {label(aAndB)}
            </p>
            <p style={{
              color: active(notAAndB),
              fontSize: '28px',
              fontWeight: 700,
              margin: 0,
              transition: 'all 0.3s',
            }}>
              {label(notAAndB)}
            </p>
            <p style={{ color: '#64748b', fontSize: '11px', margin: '4px 0 0' }}>
              뒤집기
            </p>
          </div>
        </div>

        {/* Step 2: Combining */}
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '2px 0' }}>
          ↓ ①과 ③을 AND로 합치면 ↓
        </div>

        {/* Results */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}>
          {/* Sum = XOR = (A OR B) AND NOT(A AND B) */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
            border: `1px solid ${active(xorResult)}`,
            transition: 'all 0.3s',
          }}>
            <p style={{ color: '#fcd34d', fontSize: '14px', margin: '0 0 4px', fontWeight: 600 }}>합 (Sum)</p>
            <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 8px' }}>
              ① AND ③ = {label(aOrB)} AND {label(notAAndB)}
            </p>
            <p style={{
              color: xorResult ? '#fcd34d' : '#475569',
              fontSize: '36px',
              fontWeight: 700,
              margin: 0,
              transition: 'all 0.3s',
            }}>
              {label(xorResult)}
            </p>
            <p style={{ color: '#64748b', fontSize: '11px', margin: '6px 0 0' }}>
              = XOR 결과!
            </p>
          </div>

          {/* Carry = AND */}
          <div style={{
            background: 'rgba(30,41,59,0.6)',
            borderRadius: '12px',
            padding: '16px',
            textAlign: 'center',
            border: `1px solid ${active(carry)}`,
            transition: 'all 0.3s',
          }}>
            <p style={{ color: '#6ee7b7', fontSize: '14px', margin: '0 0 4px', fontWeight: 600 }}>올림 (Carry)</p>
            <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 8px' }}>
              ② 그대로 = {label(aAndB)}
            </p>
            <p style={{
              color: carry ? '#6ee7b7' : '#475569',
              fontSize: '36px',
              fontWeight: 700,
              margin: 0,
              transition: 'all 0.3s',
            }}>
              {label(carry)}
            </p>
            <p style={{ color: '#64748b', fontSize: '11px', margin: '6px 0 0' }}>
              = AND 결과!
            </p>
          </div>
        </div>

        {/* Final answer */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          background: selected === 3 ? 'rgba(239,68,68,0.1)' : 'rgba(30,41,59,0.4)',
          borderRadius: '10px',
          border: selected === 3 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(71,85,105,0.3)',
          transition: 'all 0.3s',
        }}>
          <p style={{ color: '#e2e8f0', fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>
            {a} + {b} = {carry}{xorResult} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '13px' }}>(2진수)</span>
            {' = '}{a + b} <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '13px' }}>(10진수)</span>
          </p>
          {selected === 3 && (
            <p style={{ color: '#fca5a5', fontSize: '12px', margin: '4px 0 0' }}>
              1+1=10(2진수) — 올림이 발생! XOR이 없으면 이 덧셈을 만들 수 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
