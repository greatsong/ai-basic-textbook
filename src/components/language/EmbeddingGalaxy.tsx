import { useState, useMemo, useCallback, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Color constants (7차시 다크 테마) ───
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
  orange: '#f97316',
  pink: '#ec4899',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  purple: '#a855f7',
};

const mono = 'var(--sl-font-mono, monospace)';

// ─── Types ───
type Category = '동물' | '음식' | '감정' | '왕족' | '국가도시' | '행동' | '신체' | '학교' | '자연' | '기술';

interface WordPoint {
  word: string;
  category: Category;
  coords: [number, number, number];
}

// ─── Category colors ───
const CATEGORY_COLORS: Record<Category, string> = {
  동물: '#f97316',
  음식: '#eab308',
  감정: '#ec4899',
  왕족: '#a855f7',
  국가도시: '#3b82f6',
  행동: '#10b981',
  신체: '#ef4444',
  학교: '#06b6d4',
  자연: '#22c55e',
  기술: '#8b5cf6',
};

const CATEGORY_LABELS: Record<Category, string> = {
  동물: '동물',
  음식: '음식',
  감정: '감정',
  왕족: '왕족',
  국가도시: '국가/도시',
  행동: '행동',
  신체: '신체',
  학교: '학교',
  자연: '자연',
  기술: '기술',
};

// ─────────────────────────────────────────────────────────────
// Pre-computed embedding data (~200 Korean words)
//
// Cluster centers (designed so vector arithmetic works):
//   동물:    center ~( 5,  3,  1)
//   음식:    center ~( 4, -4,  2)
//   감정:    center ~(-4,  5,  0)
//   왕족:    center ~(-5, -2,  4)
//   국가도시: center ~( 0, -6, -4)
//   행동:    center ~(-2,  0, -5)
//   신체:    center ~( 2,  6, -3)
//   학교:    center ~(-6,  2, -2)
//   자연:    center ~( 6, -1, -5)
//   기술:    center ~(-3, -5, -6)
//
// Vector arithmetic constraints:
//   남자 = (-3.5, -1.0, 3.0)   [왕족 cluster]
//   여자 = (-3.8, -1.5, 4.5)   [왕족 cluster]
//   왕   = (-5.0, -2.0, 3.8)   [왕족 cluster]
//   여왕 = (-5.3, -2.5, 5.3)   [왕족 cluster]
//   So: 왕 - 남자 + 여자 = (-5.0+3.5-3.8, -2.0+1.0-1.5, 3.8-3.0+4.5) = (-5.3, -2.5, 5.3) = 여왕 ✓
//
//   프랑스 = ( 0.5, -6.5, -3.5)
//   파리   = ( 0.8, -6.2, -4.8)
//   일본   = (-0.5, -5.8, -3.0)
//   도쿄   = (-0.2, -5.5, -4.3)
//   So: 파리 - 프랑스 + 일본 = (0.8-0.5-0.5, -6.2+6.5-5.8, -4.8+3.5-3.0) = (-0.2, -5.5, -4.3) = 도쿄 ✓
// ─────────────────────────────────────────────────────────────

const WORDS: WordPoint[] = [
  // ──── 동물 (20 words) ── center ~(5, 3, 1) ────
  { word: '고양이', category: '동물', coords: [5.2, 3.4, 0.8] },
  { word: '강아지', category: '동물', coords: [5.5, 3.1, 1.2] },
  { word: '사자', category: '동물', coords: [4.3, 2.5, 0.5] },
  { word: '호랑이', category: '동물', coords: [4.5, 2.3, 0.7] },
  { word: '새', category: '동물', coords: [5.8, 4.0, 1.5] },
  { word: '물고기', category: '동물', coords: [6.0, 3.8, 0.2] },
  { word: '곰', category: '동물', coords: [4.0, 2.8, 1.0] },
  { word: '토끼', category: '동물', coords: [5.6, 3.6, 1.8] },
  { word: '코끼리', category: '동물', coords: [3.8, 2.2, 0.3] },
  { word: '돌고래', category: '동물', coords: [6.2, 3.5, -0.2] },
  { word: '말', category: '동물', coords: [4.7, 3.0, 1.4] },
  { word: '원숭이', category: '동물', coords: [5.0, 3.8, 0.6] },
  { word: '펭귄', category: '동물', coords: [5.9, 4.2, 0.0] },
  { word: '여우', category: '동물', coords: [4.8, 2.6, 1.6] },
  { word: '늑대', category: '동물', coords: [4.2, 2.4, 1.3] },
  { word: '뱀', category: '동물', coords: [5.3, 2.0, 0.4] },
  { word: '독수리', category: '동물', coords: [5.7, 4.3, 1.9] },
  { word: '거북이', category: '동물', coords: [6.1, 3.2, -0.1] },
  { word: '하마', category: '동물', coords: [3.9, 2.7, 0.9] },
  { word: '기린', category: '동물', coords: [4.4, 3.3, 1.1] },

  // ──── 음식 (20 words) ── center ~(4, -4, 2) ────
  { word: '밥', category: '음식', coords: [4.2, -3.8, 2.0] },
  { word: '김치', category: '음식', coords: [4.5, -4.2, 2.3] },
  { word: '피자', category: '음식', coords: [3.5, -3.5, 1.5] },
  { word: '사과', category: '음식', coords: [3.8, -4.5, 2.8] },
  { word: '바나나', category: '음식', coords: [3.6, -4.3, 2.6] },
  { word: '라면', category: '음식', coords: [4.8, -3.6, 1.8] },
  { word: '치킨', category: '음식', coords: [4.0, -3.2, 1.2] },
  { word: '떡볶이', category: '음식', coords: [4.6, -4.0, 2.2] },
  { word: '초콜릿', category: '음식', coords: [3.2, -4.8, 3.0] },
  { word: '아이스크림', category: '음식', coords: [3.0, -4.6, 2.9] },
  { word: '빵', category: '음식', coords: [3.4, -3.4, 1.6] },
  { word: '과일', category: '음식', coords: [3.7, -4.4, 2.7] },
  { word: '채소', category: '음식', coords: [4.3, -4.7, 2.5] },
  { word: '고기', category: '음식', coords: [4.1, -3.0, 1.0] },
  { word: '생선', category: '음식', coords: [4.7, -3.3, 1.4] },
  { word: '국수', category: '음식', coords: [4.9, -3.7, 1.9] },
  { word: '비빔밥', category: '음식', coords: [4.4, -4.1, 2.1] },
  { word: '불고기', category: '음식', coords: [4.0, -3.1, 1.1] },
  { word: '김밥', category: '음식', coords: [4.3, -3.9, 2.4] },
  { word: '떡', category: '음식', coords: [4.6, -4.3, 2.0] },

  // ──── 감정 (20 words) ── center ~(-4, 5, 0) ────
  { word: '기쁨', category: '감정', coords: [-3.5, 5.5, 0.3] },
  { word: '슬픔', category: '감정', coords: [-4.5, 5.2, -0.5] },
  { word: '분노', category: '감정', coords: [-4.8, 4.5, -0.8] },
  { word: '사랑', category: '감정', coords: [-3.2, 5.8, 0.8] },
  { word: '공포', category: '감정', coords: [-4.6, 4.3, -1.0] },
  { word: '놀람', category: '감정', coords: [-3.8, 5.0, 0.0] },
  { word: '행복', category: '감정', coords: [-3.3, 5.6, 0.5] },
  { word: '외로움', category: '감정', coords: [-4.7, 5.3, -0.3] },
  { word: '감사', category: '감정', coords: [-3.0, 5.4, 0.6] },
  { word: '희망', category: '감정', coords: [-3.4, 5.9, 0.9] },
  { word: '두려움', category: '감정', coords: [-4.4, 4.4, -0.9] },
  { word: '즐거움', category: '감정', coords: [-3.6, 5.7, 0.4] },
  { word: '걱정', category: '감정', coords: [-4.2, 4.8, -0.6] },
  { word: '용기', category: '감정', coords: [-3.9, 4.6, -0.2] },
  { word: '평화', category: '감정', coords: [-3.1, 6.0, 1.0] },
  { word: '질투', category: '감정', coords: [-4.3, 4.7, -0.7] },
  { word: '설렘', category: '감정', coords: [-3.7, 5.1, 0.2] },
  { word: '그리움', category: '감정', coords: [-4.0, 5.4, 0.1] },
  { word: '만족', category: '감정', coords: [-3.4, 5.3, 0.7] },
  { word: '후회', category: '감정', coords: [-4.6, 4.9, -0.4] },

  // ──── 왕족 (20 words) ── center ~(-5, -2, 4) ────
  // Vector arithmetic anchors:
  { word: '왕', category: '왕족', coords: [-5.0, -2.0, 3.8] },
  { word: '여왕', category: '왕족', coords: [-5.3, -2.5, 5.3] },
  { word: '남자', category: '왕족', coords: [-3.5, -1.0, 3.0] },
  { word: '여자', category: '왕족', coords: [-3.8, -1.5, 4.5] },
  { word: '왕자', category: '왕족', coords: [-5.2, -1.8, 3.5] },
  { word: '공주', category: '왕족', coords: [-5.4, -2.3, 5.0] },
  { word: '왕관', category: '왕족', coords: [-5.6, -2.2, 4.2] },
  { word: '왕좌', category: '왕족', coords: [-5.8, -2.4, 4.0] },
  { word: '왕국', category: '왕족', coords: [-5.5, -2.6, 3.6] },
  { word: '궁전', category: '왕족', coords: [-5.7, -2.8, 4.5] },
  { word: '왕실', category: '왕족', coords: [-5.4, -2.1, 4.1] },
  { word: '제왕', category: '왕족', coords: [-5.1, -1.9, 3.9] },
  { word: '황제', category: '왕족', coords: [-4.9, -1.7, 3.4] },
  { word: '황후', category: '왕족', coords: [-5.2, -2.2, 5.1] },
  { word: '기사', category: '왕족', coords: [-4.6, -1.5, 3.2] },
  { word: '귀족', category: '왕족', coords: [-4.8, -1.8, 4.3] },
  { word: '신하', category: '왕족', coords: [-5.3, -2.7, 3.7] },
  { word: '성', category: '왕족', coords: [-5.9, -3.0, 4.4] },
  { word: '왕비', category: '왕족', coords: [-5.1, -2.3, 5.2] },
  { word: '소년', category: '왕족', coords: [-3.6, -1.2, 3.1] },

  // ──── 국가/도시 (20 words) ── center ~(0, -6, -4) ────
  // Vector arithmetic anchors:
  { word: '프랑스', category: '국가도시', coords: [0.5, -6.5, -3.5] },
  { word: '파리', category: '국가도시', coords: [0.8, -6.2, -4.8] },
  { word: '일본', category: '국가도시', coords: [-0.5, -5.8, -3.0] },
  { word: '도쿄', category: '국가도시', coords: [-0.2, -5.5, -4.3] },
  { word: '한국', category: '국가도시', coords: [-0.3, -5.9, -3.2] },
  { word: '서울', category: '국가도시', coords: [0.0, -5.6, -4.5] },
  { word: '미국', category: '국가도시', coords: [1.0, -6.8, -3.8] },
  { word: '뉴욕', category: '국가도시', coords: [1.3, -6.5, -5.1] },
  { word: '중국', category: '국가도시', coords: [-0.8, -6.0, -3.3] },
  { word: '베이징', category: '국가도시', coords: [-0.5, -5.7, -4.6] },
  { word: '영국', category: '국가도시', coords: [0.7, -6.7, -3.6] },
  { word: '런던', category: '국가도시', coords: [1.0, -6.4, -4.9] },
  { word: '독일', category: '국가도시', coords: [0.3, -6.3, -3.4] },
  { word: '베를린', category: '국가도시', coords: [0.6, -6.0, -4.7] },
  { word: '이탈리아', category: '국가도시', coords: [0.2, -6.6, -3.7] },
  { word: '로마', category: '국가도시', coords: [0.5, -6.3, -5.0] },
  { word: '호주', category: '국가도시', coords: [1.2, -6.2, -3.9] },
  { word: '시드니', category: '국가도시', coords: [1.5, -5.9, -5.2] },
  { word: '캐나다', category: '국가도시', coords: [1.1, -6.9, -3.7] },
  { word: '스페인', category: '국가도시', coords: [0.1, -6.4, -3.6] },

  // ──── 행동 (20 words) ── center ~(-2, 0, -5) ────
  { word: '걷다', category: '행동', coords: [-1.5, 0.5, -4.5] },
  { word: '뛰다', category: '행동', coords: [-1.3, 0.8, -4.8] },
  { word: '먹다', category: '행동', coords: [-2.5, -0.5, -5.2] },
  { word: '마시다', category: '행동', coords: [-2.3, -0.3, -5.4] },
  { word: '자다', category: '행동', coords: [-2.8, 0.2, -4.8] },
  { word: '읽다', category: '행동', coords: [-1.8, 0.3, -5.5] },
  { word: '쓰다', category: '행동', coords: [-1.6, 0.1, -5.3] },
  { word: '듣다', category: '행동', coords: [-2.2, 0.6, -5.0] },
  { word: '보다', category: '행동', coords: [-2.0, 0.4, -4.6] },
  { word: '말하다', category: '행동', coords: [-2.4, -0.1, -5.1] },
  { word: '노래하다', category: '행동', coords: [-1.7, 0.7, -4.9] },
  { word: '춤추다', category: '행동', coords: [-1.4, 0.9, -4.7] },
  { word: '웃다', category: '행동', coords: [-2.6, 0.0, -5.6] },
  { word: '울다', category: '행동', coords: [-2.7, -0.2, -5.7] },
  { word: '생각하다', category: '행동', coords: [-1.9, 0.2, -5.8] },
  { word: '만들다', category: '행동', coords: [-1.5, -0.4, -4.4] },
  { word: '가르치다', category: '행동', coords: [-2.1, 0.5, -5.2] },
  { word: '배우다', category: '행동', coords: [-2.0, 0.3, -5.3] },
  { word: '놀다', category: '행동', coords: [-1.2, 1.0, -4.6] },
  { word: '일하다', category: '행동', coords: [-2.3, -0.6, -5.0] },

  // ──── 신체 (20 words) ── center ~(2, 6, -3) ────
  { word: '머리', category: '신체', coords: [2.0, 6.5, -2.8] },
  { word: '손', category: '신체', coords: [2.3, 5.8, -3.2] },
  { word: '발', category: '신체', coords: [2.5, 5.5, -3.5] },
  { word: '눈', category: '신체', coords: [1.8, 6.8, -2.5] },
  { word: '귀', category: '신체', coords: [1.6, 6.6, -2.6] },
  { word: '코', category: '신체', coords: [1.9, 6.7, -2.4] },
  { word: '입', category: '신체', coords: [2.1, 6.4, -2.7] },
  { word: '팔', category: '신체', coords: [2.4, 5.7, -3.3] },
  { word: '다리', category: '신체', coords: [2.6, 5.4, -3.6] },
  { word: '어깨', category: '신체', coords: [2.2, 5.9, -3.1] },
  { word: '가슴', category: '신체', coords: [1.7, 6.2, -2.9] },
  { word: '배', category: '신체', coords: [2.0, 6.0, -3.0] },
  { word: '허리', category: '신체', coords: [2.3, 5.6, -3.4] },
  { word: '무릎', category: '신체', coords: [2.7, 5.3, -3.7] },
  { word: '손가락', category: '신체', coords: [2.4, 5.9, -3.2] },
  { word: '발가락', category: '신체', coords: [2.6, 5.5, -3.5] },
  { word: '이마', category: '신체', coords: [1.5, 6.9, -2.3] },
  { word: '턱', category: '신체', coords: [2.2, 6.3, -2.8] },
  { word: '목', category: '신체', coords: [1.8, 6.1, -3.0] },
  { word: '등', category: '신체', coords: [1.6, 5.8, -3.3] },

  // ──── 학교 (20 words) ── center ~(-6, 2, -2) ────
  { word: '학교', category: '학교', coords: [-6.0, 2.0, -2.0] },
  { word: '선생님', category: '학교', coords: [-5.8, 2.3, -1.8] },
  { word: '학생', category: '학교', coords: [-6.2, 1.8, -2.2] },
  { word: '교실', category: '학교', coords: [-6.1, 2.1, -1.9] },
  { word: '시험', category: '학교', coords: [-5.5, 1.5, -2.5] },
  { word: '공부', category: '학교', coords: [-5.7, 1.7, -2.3] },
  { word: '숙제', category: '학교', coords: [-5.6, 1.6, -2.4] },
  { word: '성적', category: '학교', coords: [-5.4, 1.4, -2.6] },
  { word: '졸업', category: '학교', coords: [-6.3, 2.5, -1.6] },
  { word: '대학', category: '학교', coords: [-6.5, 2.7, -1.5] },
  { word: '도서관', category: '학교', coords: [-6.4, 2.4, -1.7] },
  { word: '수업', category: '학교', coords: [-5.9, 2.2, -2.1] },
  { word: '교과서', category: '학교', coords: [-5.8, 1.9, -2.0] },
  { word: '운동장', category: '학교', coords: [-6.6, 2.8, -1.4] },
  { word: '급식', category: '학교', coords: [-6.0, 1.5, -2.5] },
  { word: '친구', category: '학교', coords: [-6.3, 2.6, -1.6] },
  { word: '교장', category: '학교', coords: [-5.5, 2.5, -1.8] },
  { word: '반', category: '학교', coords: [-6.1, 1.9, -2.2] },
  { word: '칠판', category: '학교', coords: [-6.2, 2.0, -1.9] },
  { word: '책상', category: '학교', coords: [-6.4, 2.2, -2.0] },

  // ──── 자연 (20 words) ── center ~(6, -1, -5) ────
  { word: '산', category: '자연', coords: [6.0, -1.0, -5.0] },
  { word: '바다', category: '자연', coords: [6.5, -0.5, -4.5] },
  { word: '강', category: '자연', coords: [6.3, -0.8, -4.8] },
  { word: '하늘', category: '자연', coords: [5.8, -1.5, -5.5] },
  { word: '구름', category: '자연', coords: [5.6, -1.3, -5.3] },
  { word: '비', category: '자연', coords: [5.5, -1.7, -5.7] },
  { word: '눈(날씨)', category: '자연', coords: [5.4, -1.8, -5.8] },
  { word: '바람', category: '자연', coords: [5.7, -1.4, -5.4] },
  { word: '꽃', category: '자연', coords: [6.2, -0.6, -4.6] },
  { word: '나무', category: '자연', coords: [6.4, -0.7, -4.7] },
  { word: '숲', category: '자연', coords: [6.6, -0.4, -4.4] },
  { word: '호수', category: '자연', coords: [6.1, -0.9, -4.9] },
  { word: '별', category: '자연', coords: [5.3, -1.9, -5.9] },
  { word: '달', category: '자연', coords: [5.5, -1.6, -5.6] },
  { word: '태양', category: '자연', coords: [5.9, -1.2, -5.2] },
  { word: '무지개', category: '자연', coords: [6.7, -0.3, -4.3] },
  { word: '폭포', category: '자연', coords: [6.0, -1.1, -5.1] },
  { word: '사막', category: '자연', coords: [5.2, -2.0, -6.0] },
  { word: '화산', category: '자연', coords: [5.8, -1.6, -5.4] },
  { word: '동굴', category: '자연', coords: [6.3, -0.5, -4.5] },

  // ──── 기술 (20 words) ── center ~(-3, -5, -6) ────
  { word: '컴퓨터', category: '기술', coords: [-3.0, -5.0, -6.0] },
  { word: '인터넷', category: '기술', coords: [-2.8, -4.8, -5.8] },
  { word: '스마트폰', category: '기술', coords: [-3.2, -5.2, -6.2] },
  { word: '인공지능', category: '기술', coords: [-2.5, -4.5, -5.5] },
  { word: '로봇', category: '기술', coords: [-2.7, -4.7, -5.7] },
  { word: '프로그래밍', category: '기술', coords: [-3.4, -5.4, -6.4] },
  { word: '데이터', category: '기술', coords: [-2.6, -4.6, -5.6] },
  { word: '알고리즘', category: '기술', coords: [-3.3, -5.3, -6.3] },
  { word: '소프트웨어', category: '기술', coords: [-3.5, -5.5, -6.5] },
  { word: '하드웨어', category: '기술', coords: [-3.6, -5.6, -6.6] },
  { word: '네트워크', category: '기술', coords: [-2.9, -4.9, -5.9] },
  { word: '서버', category: '기술', coords: [-3.1, -5.1, -6.1] },
  { word: '클라우드', category: '기술', coords: [-2.4, -4.4, -5.4] },
  { word: '앱', category: '기술', coords: [-3.3, -5.2, -6.1] },
  { word: '게임', category: '기술', coords: [-2.3, -4.3, -5.3] },
  { word: '가상현실', category: '기술', coords: [-2.2, -4.2, -5.2] },
  { word: '블록체인', category: '기술', coords: [-3.7, -5.7, -6.7] },
  { word: '빅데이터', category: '기술', coords: [-2.6, -4.5, -5.5] },
  { word: '코딩', category: '기술', coords: [-3.4, -5.3, -6.3] },
  { word: '반도체', category: '기술', coords: [-3.8, -5.8, -6.8] },
];

// ─── Utility functions ───

function euclideanDist(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function cosineSimilarity(a: [number, number, number], b: [number, number, number]): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const magA = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const magB = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function vecAdd(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vecSub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function findNearestWord(target: [number, number, number], exclude: string[] = []): WordPoint | null {
  let best: WordPoint | null = null;
  let bestDist = Infinity;
  for (const wp of WORDS) {
    if (exclude.includes(wp.word)) continue;
    const d = euclideanDist(target, wp.coords);
    if (d < bestDist) {
      bestDist = d;
      best = wp;
    }
  }
  return best;
}

// ─── Vector arithmetic presets ───
interface VectorPreset {
  label: string;
  a: string;   // word A
  b: string;   // word B (subtract)
  c: string;   // word C (add)
  expected: string; // expected result word
}

const VECTOR_PRESETS: VectorPreset[] = [
  { label: '왕 - 남자 + 여자 = ?', a: '왕', b: '남자', c: '여자', expected: '여왕' },
  { label: '파리 - 프랑스 + 일본 = ?', a: '파리', b: '프랑스', c: '일본', expected: '도쿄' },
  { label: '서울 - 한국 + 미국 = ?', a: '서울', b: '한국', c: '미국', expected: '뉴욕' },
  { label: '공주 - 여자 + 남자 = ?', a: '공주', b: '여자', c: '남자', expected: '왕자' },
  { label: '런던 - 영국 + 프랑스 = ?', a: '런던', b: '영국', c: '프랑스', expected: '파리' },
];

function getWordCoords(word: string): [number, number, number] | null {
  const wp = WORDS.find(w => w.word === word);
  return wp ? wp.coords : null;
}

// ─── WebGL detection ───
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// ──────────────────────────────────────
// 3D Sub-components
// ──────────────────────────────────────

/** Frame delta clamping: prevents huge delta after tab switch */
function DeltaClamp() {
  useFrame((state, delta) => {
    if (delta > 0.1) {
      state.clock.elapsedTime -= (delta - 0.016);
    }
  });
  return null;
}

/** Particle background (space dust) */
function SpaceBackground() {
  const particlesRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const count = 800;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 25 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const palette = [
        [0.49, 0.36, 0.99],
        [0.13, 0.83, 0.93],
        [0.96, 0.44, 0.71],
        [1, 1, 1],
        [0.98, 0.75, 0.15],
      ];
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }

    return { positions, colors };
  }, []);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.003;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        {/* @ts-expect-error R3F bufferAttribute typing */}
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
        {/* @ts-expect-error R3F bufferAttribute typing */}
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={colors.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** Translucent axis line with label */
function AxisLine({ dir, color, label }: { dir: [number, number, number]; color: string; label: string }) {
  return (
    <group>
      <line>
        <bufferGeometry>
          {/* @ts-expect-error R3F bufferAttribute typing */}
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([0, 0, 0, ...dir])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.2} />
      </line>
      <Html position={dir} center style={{ pointerEvents: 'none' }}>
        <span style={{
          color, fontSize: 10, fontFamily: mono, fontWeight: 700,
          textShadow: '0 0 4px rgba(0,0,0,0.8)',
        }}>
          {label}
        </span>
      </Html>
    </group>
  );
}

/** A single word star node */
interface WordStarProps {
  wp: WordPoint;
  isSelected: boolean;
  isNeighbor: boolean;
  isSearchResult: boolean;
  isArithmeticHighlight: boolean;
  arithmeticRole?: 'a' | 'b' | 'c' | 'result' | 'target';
  neighborRank?: number;
  showLabel: boolean;
  onClick: (word: string) => void;
  cameraDistance: number;
}

function WordStar({
  wp, isSelected, isNeighbor, isSearchResult, isArithmeticHighlight,
  arithmeticRole, neighborRank, showLabel, onClick, cameraDistance,
}: WordStarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = CATEGORY_COLORS[wp.category];
  const parsedColor = useMemo(() => new THREE.Color(color), [color]);

  const baseSize = isSelected ? 0.28 : isArithmeticHighlight ? 0.25 : isNeighbor ? 0.22 : isSearchResult ? 0.22 : 0.15;
  const glowSize = baseSize * 2.2;

  // Adaptive label visibility: show if close enough or hovered/selected/neighbor
  const shouldShowLabel = hovered || isSelected || isNeighbor || isSearchResult || isArithmeticHighlight || (showLabel && cameraDistance < 20);

  useFrame((state) => {
    if (meshRef.current) {
      if (isSelected || hovered) {
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
        meshRef.current.scale.setScalar(pulse);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }
    if (glowRef.current) {
      const glow = 0.08 + Math.sin(state.clock.elapsedTime * 2 + wp.coords[0]) * 0.04;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        isSelected ? 0.2 : isNeighbor ? 0.15 : isArithmeticHighlight ? 0.18 : glow;
    }
  });

  const roleColors: Record<string, string> = {
    a: '#f59e0b',
    b: '#ef4444',
    c: '#3b82f6',
    result: '#10b981',
    target: '#a855f7',
  };

  const roleLabels: Record<string, string> = {
    a: 'A',
    b: '-B',
    c: '+C',
    result: '= ?',
    target: '목표',
  };

  return (
    <group position={wp.coords}>
      {/* Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[glowSize, 10, 10]} />
        <meshBasicMaterial
          color={isArithmeticHighlight && arithmeticRole ? new THREE.Color(roleColors[arithmeticRole]) : parsedColor}
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>

      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(wp.word); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[baseSize, 16, 16]} />
        <meshStandardMaterial
          color={isArithmeticHighlight && arithmeticRole ? new THREE.Color(roleColors[arithmeticRole]) : parsedColor}
          emissive={isArithmeticHighlight && arithmeticRole ? new THREE.Color(roleColors[arithmeticRole]) : parsedColor}
          emissiveIntensity={isSelected ? 1.5 : isNeighbor ? 0.9 : isArithmeticHighlight ? 1.2 : hovered ? 0.8 : 0.5}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Label */}
      {shouldShowLabel && (
        <Html position={[0, baseSize + 0.2, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            whiteSpace: 'nowrap',
            textAlign: 'center',
            transform: 'translate(-50%, -100%)',
            position: 'relative',
            left: '50%',
          }}>
            {/* Arithmetic role badge */}
            {isArithmeticHighlight && arithmeticRole && (
              <div style={{
                fontSize: 9, fontWeight: 800,
                color: '#fff',
                background: roleColors[arithmeticRole],
                borderRadius: 6, padding: '1px 5px',
                marginBottom: 2,
                display: 'inline-block',
              }}>
                {roleLabels[arithmeticRole]}
              </div>
            )}
            <div style={{
              fontSize: isSelected ? 13 : hovered ? 12 : 10,
              fontWeight: isSelected ? 800 : 600,
              color: isSelected ? '#fff' : hovered ? '#e2e8f0' : color,
              textShadow: '0 0 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)',
              fontFamily: mono,
            }}>
              {wp.word}
            </div>
            {/* Neighbor rank */}
            {isNeighbor && neighborRank !== undefined && (
              <div style={{
                fontSize: 8, color: C.dim,
                textShadow: '0 0 4px rgba(0,0,0,0.9)',
              }}>
                #{neighborRank + 1}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Connection beam between two words */
function ConnectionBeam({ from, to, color = '#fbbf24', intensity = 1.0 }: {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  intensity?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const fromVec = useMemo(() => new THREE.Vector3(...from), [from]);
  const toVec = useMemo(() => new THREE.Vector3(...to), [to]);
  const { mid, length } = useMemo(() => ({
    mid: new THREE.Vector3().addVectors(fromVec, toVec).multiplyScalar(0.5),
    length: fromVec.distanceTo(toVec),
  }), [fromVec, toVec]);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.position.copy(mid);
    meshRef.current.lookAt(toVec);
    const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
    meshRef.current.scale.set(pulse * 0.03 * intensity, pulse * 0.03 * intensity, length);
  });

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
      <meshBasicMaterial
        color={new THREE.Color(color)}
        transparent
        opacity={0.4 * intensity}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Animated arrow for vector arithmetic */
function VectorArrow({ from, to, color, label }: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  label: string;
}) {
  const [progress, setProgress] = useState(0);

  useFrame((_, delta) => {
    setProgress(p => Math.min(p + delta * 1.5, 1));
  });

  const currentTo: [number, number, number] = [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
    from[2] + (to[2] - from[2]) * progress,
  ];

  const points = useMemo(() =>
    new Float32Array([...from, ...currentTo]),
    [from, currentTo]
  );

  return (
    <group>
      <line>
        <bufferGeometry>
          {/* @ts-expect-error R3F bufferAttribute typing */}
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={points}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.8} />
      </line>
      {/* Arrow head (small cone) */}
      {progress > 0.9 && (
        <mesh position={currentTo}>
          <coneGeometry args={[0.12, 0.3, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      )}
      {/* Label at midpoint */}
      <Html
        position={[
          (from[0] + currentTo[0]) / 2,
          (from[1] + currentTo[1]) / 2 + 0.4,
          (from[2] + currentTo[2]) / 2,
        ]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          fontSize: 9, fontWeight: 700, color,
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 4, padding: '1px 4px',
          textShadow: '0 0 4px rgba(0,0,0,0.9)',
          fontFamily: mono,
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

/** Camera distance tracker */
function CameraTracker({ onDistanceChange }: { onDistanceChange: (d: number) => void }) {
  const { camera } = useThree();
  useFrame(() => {
    const d = camera.position.length();
    onDistanceChange(d);
  });
  return null;
}

// ──────────────────────────────────────
// Main Galaxy Scene (inside Canvas)
// ──────────────────────────────────────

interface GalaxySceneProps {
  selectedWord: string | null;
  neighbors: WordPoint[];
  searchResults: Set<string>;
  arithmeticWords: Map<string, 'a' | 'b' | 'c' | 'result' | 'target'>;
  arithmeticArrows: { from: [number, number, number]; to: [number, number, number]; color: string; label: string }[];
  showAllLabels: boolean;
  onWordClick: (word: string) => void;
  visibleCategories: Set<Category>;
}

function GalaxyScene({
  selectedWord, neighbors, searchResults, arithmeticWords,
  arithmeticArrows, showAllLabels, onWordClick, visibleCategories,
}: GalaxySceneProps) {
  const [cameraDistance, setCameraDistance] = useState(22);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleVisibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const neighborSet = useMemo(() => new Set(neighbors.map(n => n.word)), [neighbors]);
  const neighborRankMap = useMemo(() => {
    const m = new Map<string, number>();
    neighbors.forEach((n, i) => m.set(n.word, i));
    return m;
  }, [neighbors]);

  // Connections from selected word to neighbors
  const connections = useMemo(() => {
    if (!selectedWord) return [];
    const sel = WORDS.find(w => w.word === selectedWord);
    if (!sel) return [];
    return neighbors.map((n, i) => ({
      key: `${selectedWord}-${n.word}`,
      from: sel.coords,
      to: n.coords,
      intensity: 1 - i / Math.max(neighbors.length, 1),
      color: CATEGORY_COLORS[n.category],
    }));
  }, [selectedWord, neighbors]);

  const filteredWords = useMemo(
    () => WORDS.filter(w => visibleCategories.has(w.category)),
    [visibleCategories]
  );

  return (
    <>
      <DeltaClamp />
      <CameraTracker onDistanceChange={setCameraDistance} />

      {/* Lighting */}
      <ambientLight intensity={0.25} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#7c5cfc" />
      <pointLight position={[-10, -5, 5]} intensity={0.4} color="#22d3ee" />
      <pointLight position={[0, 10, -10]} intensity={0.25} color="#f472b6" />

      {/* Background */}
      <SpaceBackground />
      <Stars radius={80} depth={40} count={1200} factor={1.5} saturation={0.4} fade speed={0.3} />

      {/* Grid */}
      <gridHelper args={[20, 20, '#2a1f5e', '#1a1040']} position={[0, -8, 0]} />

      {/* Axes */}
      <AxisLine dir={[10, 0, 0]} color="#ff4466" label="Dim 1" />
      <AxisLine dir={[0, 10, 0]} color="#44ff66" label="Dim 2" />
      <AxisLine dir={[0, 0, 10]} color="#4488ff" label="Dim 3" />

      {/* Word stars */}
      {filteredWords.map((wp) => (
        <WordStar
          key={wp.word}
          wp={wp}
          isSelected={wp.word === selectedWord}
          isNeighbor={neighborSet.has(wp.word) && wp.word !== selectedWord}
          isSearchResult={searchResults.has(wp.word)}
          isArithmeticHighlight={arithmeticWords.has(wp.word)}
          arithmeticRole={arithmeticWords.get(wp.word)}
          neighborRank={neighborRankMap.get(wp.word)}
          showLabel={showAllLabels}
          onClick={onWordClick}
          cameraDistance={cameraDistance}
        />
      ))}

      {/* Neighbor connections */}
      {connections.map((conn) => (
        <ConnectionBeam
          key={conn.key}
          from={conn.from}
          to={conn.to}
          intensity={conn.intensity}
          color={conn.color}
        />
      ))}

      {/* Vector arithmetic arrows */}
      {arithmeticArrows.map((arrow, i) => (
        <VectorArrow key={i} from={arrow.from} to={arrow.to} color={arrow.color} label={arrow.label} />
      ))}

      {/* Camera controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxDistance={45}
        minDistance={4}
        dampingFactor={0.1}
        enableDamping
      />
    </>
  );
}

// ──────────────────────────────────────
// 2D SVG Fallback (no WebGL)
// ──────────────────────────────────────

function FallbackScatter({
  selectedWord, onWordClick, visibleCategories,
}: {
  selectedWord: string | null;
  onWordClick: (word: string) => void;
  visibleCategories: Set<Category>;
}) {
  // Project 3D → 2D using first two dims
  const filteredWords = WORDS.filter(w => visibleCategories.has(w.category));
  const svgW = 600;
  const svgH = 500;
  const pad = 40;

  const toX = (x: number) => pad + ((x + 8) / 16) * (svgW - 2 * pad);
  const toY = (y: number) => pad + ((8 - y) / 16) * (svgH - 2 * pad);

  return (
    <div style={{
      background: C.card, borderRadius: 16,
      border: `1px solid ${C.borderLight}`, padding: 12,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <span style={{ color: C.amber, fontSize: 11, fontWeight: 600 }}>
          WebGL 미지원 — 2D 투영도
        </span>
      </div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto' }}>
        <rect width={svgW} height={svgH} fill="rgba(15,23,42,0.8)" rx={12} />
        {filteredWords.map((wp) => {
          const isSel = wp.word === selectedWord;
          return (
            <g key={wp.word} onClick={() => onWordClick(wp.word)} style={{ cursor: 'pointer' }}>
              <circle
                cx={toX(wp.coords[0])}
                cy={toY(wp.coords[1])}
                r={isSel ? 8 : 4}
                fill={CATEGORY_COLORS[wp.category]}
                opacity={isSel ? 1 : 0.7}
                stroke={isSel ? '#fff' : 'none'}
                strokeWidth={isSel ? 2 : 0}
              />
              {isSel && (
                <text
                  x={toX(wp.coords[0])}
                  y={toY(wp.coords[1]) - 12}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={11}
                  fontFamily={mono}
                >
                  {wp.word}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ──────────────────────────────────────
// Main Exported Component
// ──────────────────────────────────────

export default function EmbeddingGalaxy() {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showVectorMode, setShowVectorMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [similarityMetric, setSimilarityMetric] = useState<'cosine' | 'euclidean'>('cosine');
  const [neighborCount] = useState(5);
  const [webglAvailable] = useState(() => isWebGLAvailable());
  const [visibleCategories, setVisibleCategories] = useState<Set<Category>>(
    () => new Set(Object.keys(CATEGORY_COLORS) as Category[])
  );

  // Selected word data
  const selectedWordData = useMemo(
    () => selectedWord ? WORDS.find(w => w.word === selectedWord) || null : null,
    [selectedWord]
  );

  // Neighbors of selected word
  const neighbors = useMemo(() => {
    if (!selectedWordData) return [];
    return WORDS
      .filter(w => w.word !== selectedWord)
      .map(w => ({
        ...w,
        dist: euclideanDist(selectedWordData.coords, w.coords),
        sim: cosineSimilarity(selectedWordData.coords, w.coords),
      }))
      .sort((a, b) =>
        similarityMetric === 'cosine' ? b.sim - a.sim : a.dist - b.dist
      )
      .slice(0, neighborCount);
  }, [selectedWordData, selectedWord, similarityMetric, neighborCount]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.trim().toLowerCase();
    return new Set(
      WORDS.filter(w => w.word.includes(q) || w.category.includes(q)).map(w => w.word)
    );
  }, [searchQuery]);

  // Vector arithmetic
  const arithmeticData = useMemo(() => {
    if (!showVectorMode || selectedPreset === null) {
      return { words: new Map<string, 'a' | 'b' | 'c' | 'result' | 'target'>(), arrows: [], result: null, targetCoords: null as [number, number, number] | null };
    }

    const preset = VECTOR_PRESETS[selectedPreset];
    const aCoords = getWordCoords(preset.a);
    const bCoords = getWordCoords(preset.b);
    const cCoords = getWordCoords(preset.c);

    if (!aCoords || !bCoords || !cCoords) {
      return { words: new Map(), arrows: [], result: null, targetCoords: null };
    }

    // A - B + C = target
    const targetCoords = vecAdd(vecSub(aCoords, bCoords), cCoords);
    const resultWord = findNearestWord(targetCoords, [preset.a, preset.b, preset.c]);

    const words = new Map<string, 'a' | 'b' | 'c' | 'result' | 'target'>();
    words.set(preset.a, 'a');
    words.set(preset.b, 'b');
    words.set(preset.c, 'c');
    if (resultWord) words.set(resultWord.word, 'result');

    // Build arrows: A → A-B, then A-B → A-B+C
    const midPoint = vecSub(aCoords, bCoords);
    // Offset mid so it's not at origin
    const arrows = [
      { from: aCoords, to: bCoords, color: '#ef4444', label: `- ${preset.b}` },
      { from: aCoords, to: vecAdd(aCoords, vecSub(cCoords, bCoords)), color: '#3b82f6', label: `+ ${preset.c}` },
    ];

    return {
      words,
      arrows,
      result: resultWord,
      targetCoords,
    };
  }, [showVectorMode, selectedPreset]);

  // Toggle category visibility
  const toggleCategory = useCallback((cat: Category) => {
    setVisibleCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(prev => prev === word ? null : word);
  }, []);

  // Find word from search and select it
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    const found = WORDS.find(w => w.word === q);
    if (found) {
      setSelectedWord(found.word);
    }
  }, [searchQuery]);

  return (
    <div style={{
      background: `linear-gradient(145deg, ${C.bg}, rgba(10,15,30,0.98))`,
      borderRadius: 20,
      border: `1px solid ${C.border}`,
      maxWidth: 1100,
      margin: '2rem auto',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      overflow: 'hidden',
    }}>
      {/* ─── Header ─── */}
      <div style={{ textAlign: 'center', padding: '24px 20px 16px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: 99, padding: '4px 14px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 14 }}>&#x2728;</span>
          <span style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>
            임베딩 갤럭시
          </span>
        </div>
        <h3 style={{ color: C.text, fontSize: 19, fontWeight: 700, margin: '4px 0 2px' }}>
          단어의 의미 공간을 탐험하세요
        </h3>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          비슷한 의미의 단어는 가까이, 다른 의미의 단어는 멀리 배치됩니다
        </p>
      </div>

      {/* ─── Main Layout ─── */}
      <div style={{ display: 'flex', minHeight: 520, padding: '0 12px 12px' }}>
        {/* ─── Left: Legend panel ─── */}
        <div style={{
          width: 130, flexShrink: 0, padding: '10px 8px',
          background: C.card, borderRadius: 14,
          border: `1px solid ${C.borderLight}`,
          marginRight: 10,
          display: 'flex', flexDirection: 'column', gap: 4,
          overflowY: 'auto',
        }}>
          <div style={{ color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4, padding: '0 4px' }}>
            카테고리
          </div>
          {(Object.keys(CATEGORY_COLORS) as Category[]).map((cat) => {
            const active = visibleCategories.has(cat);
            const count = WORDS.filter(w => w.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                  border: 'none', borderRadius: 8, padding: '5px 6px',
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  opacity: active ? 1 : 0.4,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: CATEGORY_COLORS[cat],
                  flexShrink: 0,
                  boxShadow: active ? `0 0 6px ${CATEGORY_COLORS[cat]}` : 'none',
                }} />
                <span style={{
                  color: active ? C.text : C.dim, fontSize: 11, fontWeight: 600,
                  lineHeight: 1.2,
                }}>
                  {CATEGORY_LABELS[cat]}
                </span>
                <span style={{
                  color: C.dim, fontSize: 9, marginLeft: 'auto',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
          <div style={{ borderTop: `1px solid ${C.borderLight}`, margin: '6px 0', paddingTop: 6 }}>
            <button
              onClick={() => setShowAllLabels(!showAllLabels)}
              style={{
                width: '100%', padding: '5px 6px', borderRadius: 8,
                background: showAllLabels ? 'rgba(139,92,246,0.15)' : 'transparent',
                border: showAllLabels ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                color: showAllLabels ? C.violet : C.dim,
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {showAllLabels ? '라벨 숨기기' : '전체 라벨'}
            </button>
          </div>
          <div style={{ marginTop: 2 }}>
            <div style={{ color: C.dim, fontSize: 9, fontWeight: 600, marginBottom: 4, padding: '0 4px' }}>
              유사도 기준
            </div>
            {(['cosine', 'euclidean'] as const).map(m => (
              <button
                key={m}
                onClick={() => setSimilarityMetric(m)}
                style={{
                  display: 'block', width: '100%', padding: '4px 6px',
                  borderRadius: 6, border: 'none', marginBottom: 2,
                  background: similarityMetric === m ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: similarityMetric === m ? C.blue : C.dim,
                  fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {m === 'cosine' ? '코사인' : '유클리드'}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Center: 3D Canvas ─── */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${C.borderLight}`,
            background: 'rgba(5,10,20,0.9)',
          }}>
            {webglAvailable ? (
              <Suspense fallback={
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', height: '100%', color: C.muted, fontSize: 14,
                }}>
                  3D 공간을 불러오는 중...
                </div>
              }>
                <Canvas
                  camera={{ position: [0, 5, 22], fov: 55 }}
                  gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                  dpr={[1, 1.5]}
                  style={{ width: '100%', height: '100%' }}
                >
                  <GalaxyScene
                    selectedWord={selectedWord}
                    neighbors={neighbors}
                    searchResults={searchResults}
                    arithmeticWords={arithmeticData.words}
                    arithmeticArrows={arithmeticData.arrows}
                    showAllLabels={showAllLabels}
                    onWordClick={handleWordClick}
                    visibleCategories={visibleCategories}
                  />
                </Canvas>
              </Suspense>
            ) : (
              <FallbackScatter
                selectedWord={selectedWord}
                onWordClick={handleWordClick}
                visibleCategories={visibleCategories}
              />
            )}
          </div>
          {/* Canvas hint overlay */}
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '3px 10px',
            pointerEvents: 'none',
          }}>
            <span style={{ color: C.dim, fontSize: 10 }}>
              드래그: 회전 | 스크롤: 확대/축소 | 클릭: 단어 선택
            </span>
          </div>
        </div>

        {/* ─── Right: Info panel ─── */}
        <div style={{
          width: 220, flexShrink: 0, marginLeft: 10,
          display: 'flex', flexDirection: 'column', gap: 8,
          overflowY: 'auto', maxHeight: 520,
        }}>
          {/* Selected word info */}
          <div style={{
            background: C.card, borderRadius: 14,
            border: `1px solid ${C.borderLight}`, padding: 12,
          }}>
            <div style={{ color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 8 }}>
              {selectedWord ? '선택된 단어' : '단어를 클릭하세요'}
            </div>
            {selectedWordData ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: CATEGORY_COLORS[selectedWordData.category],
                    boxShadow: `0 0 8px ${CATEGORY_COLORS[selectedWordData.category]}`,
                  }} />
                  <span style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>
                    {selectedWordData.word}
                  </span>
                </div>
                <div style={{
                  fontSize: 10, color: C.dim, fontFamily: mono,
                  background: 'rgba(15,23,42,0.5)', borderRadius: 6, padding: '4px 6px',
                  marginBottom: 8,
                }}>
                  [{selectedWordData.coords[0].toFixed(1)}, {selectedWordData.coords[1].toFixed(1)}, {selectedWordData.coords[2].toFixed(1)}]
                </div>
                <div style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 600,
                  color: CATEGORY_COLORS[selectedWordData.category],
                  background: `${CATEGORY_COLORS[selectedWordData.category]}15`,
                  borderRadius: 6, padding: '2px 8px',
                }}>
                  {CATEGORY_LABELS[selectedWordData.category]}
                </div>
              </>
            ) : (
              <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.6 }}>
                3D 공간에서 단어(별)를 클릭하면 가까운 이웃 단어들을 볼 수 있습니다.
              </div>
            )}
          </div>

          {/* Neighbors list */}
          {selectedWord && neighbors.length > 0 && (
            <div style={{
              background: C.card, borderRadius: 14,
              border: `1px solid ${C.borderLight}`, padding: 12,
            }}>
              <div style={{ color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 8 }}>
                가까운 이웃 (Top {neighborCount})
              </div>
              {neighbors.map((n, i) => (
                <div
                  key={n.word}
                  onClick={() => handleWordClick(n.word)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 6px', borderRadius: 8, marginBottom: 3,
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    transition: 'background 0.15s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: C.dim,
                    width: 16, textAlign: 'center',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: CATEGORY_COLORS[n.category],
                    flexShrink: 0,
                  }} />
                  <span style={{ color: C.text, fontSize: 12, fontWeight: 600, flex: 1 }}>
                    {n.word}
                  </span>
                  <span style={{
                    fontFamily: mono, fontSize: 9, color: C.dim,
                    textAlign: 'right',
                  }}>
                    {similarityMetric === 'cosine'
                      ? `${((n as any).sim as number).toFixed(3)}`
                      : `${((n as any).dist as number).toFixed(2)}`
                    }
                  </span>
                </div>
              ))}
              <div style={{
                marginTop: 6, padding: '4px 6px', borderRadius: 6,
                background: 'rgba(15,23,42,0.5)', textAlign: 'center',
              }}>
                <span style={{ color: C.dim, fontSize: 9 }}>
                  {similarityMetric === 'cosine' ? '코사인 유사도' : '유클리드 거리'}
                </span>
              </div>
            </div>
          )}

          {/* Vector arithmetic button + panel */}
          <div style={{
            background: C.card, borderRadius: 14,
            border: `1px solid ${C.borderLight}`, padding: 12,
          }}>
            <button
              onClick={() => { setShowVectorMode(!showVectorMode); if (!showVectorMode) setSelectedWord(null); }}
              style={{
                width: '100%', padding: '10px', borderRadius: 10,
                border: showVectorMode
                  ? `2px solid ${C.violet}`
                  : `1px solid ${C.borderLight}`,
                background: showVectorMode
                  ? 'rgba(139,92,246,0.12)'
                  : 'rgba(30,41,59,0.5)',
                color: showVectorMode ? C.violet : C.muted,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {showVectorMode ? '&#x2716; 벡터 연산 닫기' : '&#x2795; 벡터 연산 모드'}
            </button>

            {showVectorMode && (
              <div style={{ marginTop: 10 }}>
                <div style={{ color: C.dim, fontSize: 10, fontWeight: 600, marginBottom: 6 }}>
                  예제 선택:
                </div>
                {VECTOR_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedPreset(selectedPreset === i ? null : i); setSelectedWord(null); }}
                    style={{
                      display: 'block', width: '100%', padding: '7px 8px',
                      borderRadius: 8, marginBottom: 4, textAlign: 'left',
                      border: selectedPreset === i
                        ? `1px solid ${C.violet}`
                        : `1px solid ${C.borderLight}`,
                      background: selectedPreset === i
                        ? 'rgba(139,92,246,0.1)'
                        : 'transparent',
                      color: selectedPreset === i ? C.text : C.muted,
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: mono,
                    }}
                  >
                    {preset.label}
                  </button>
                ))}

                {/* Result panel */}
                {selectedPreset !== null && arithmeticData.result && (
                  <div style={{
                    marginTop: 10, padding: 10, borderRadius: 10,
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.2)',
                  }}>
                    <div style={{ color: C.emerald, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                      연산 결과
                    </div>
                    <div style={{
                      fontFamily: mono, fontSize: 12, color: C.text, lineHeight: 1.8,
                    }}>
                      <span style={{ color: '#f59e0b' }}>{VECTOR_PRESETS[selectedPreset].a}</span>
                      {' - '}
                      <span style={{ color: '#ef4444' }}>{VECTOR_PRESETS[selectedPreset].b}</span>
                      {' + '}
                      <span style={{ color: '#3b82f6' }}>{VECTOR_PRESETS[selectedPreset].c}</span>
                      <br />
                      <span style={{ color: C.dim }}>= </span>
                      <span style={{ color: C.emerald, fontWeight: 800, fontSize: 14 }}>
                        {arithmeticData.result.word}
                      </span>
                      {arithmeticData.result.word === VECTOR_PRESETS[selectedPreset].expected && (
                        <span style={{ color: C.emerald, marginLeft: 4 }}>&#x2714;</span>
                      )}
                    </div>
                    {arithmeticData.targetCoords && (
                      <div style={{
                        marginTop: 6, fontSize: 9, color: C.dim, fontFamily: mono,
                        background: 'rgba(15,23,42,0.5)', borderRadius: 6, padding: '4px 6px',
                      }}>
                        예측: [{arithmeticData.targetCoords[0].toFixed(1)}, {arithmeticData.targetCoords[1].toFixed(1)}, {arithmeticData.targetCoords[2].toFixed(1)}]
                        <br />
                        실제: [{arithmeticData.result.coords[0].toFixed(1)}, {arithmeticData.result.coords[1].toFixed(1)}, {arithmeticData.result.coords[2].toFixed(1)}]
                        <br />
                        오차: {euclideanDist(arithmeticData.targetCoords, arithmeticData.result.coords).toFixed(3)}
                      </div>
                    )}
                    <div style={{
                      marginTop: 8, padding: '8px 10px', borderRadius: 8,
                      background: 'rgba(139,92,246,0.06)',
                      border: '1px solid rgba(139,92,246,0.15)',
                      fontSize: 10, color: C.muted, lineHeight: 1.6,
                    }}>
                      단어 벡터는 <strong style={{ color: C.text }}>의미의 방향</strong>을 학습합니다.
                      &quot;왕족&quot;에서 &quot;성별&quot; 방향을 빼고 다른 &quot;성별&quot;을 더하면, 의미가 변환됩니다.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Bottom: Search bar ─── */}
      <div style={{ padding: '10px 16px 16px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: C.card, borderRadius: 12,
            border: `1px solid ${C.borderLight}`, padding: '0 12px',
          }}>
            <span style={{ color: C.dim, fontSize: 14, flexShrink: 0 }}>&#x1F50D;</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="단어를 검색하세요... (예: 고양이, 사랑, 컴퓨터)"
              style={{
                flex: 1, padding: '10px 0', border: 'none', outline: 'none',
                background: 'transparent', color: C.text, fontSize: 13,
                fontFamily: mono,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none', border: 'none', color: C.dim,
                  cursor: 'pointer', fontSize: 14, padding: 4,
                }}
              >
                &#x2716;
              </button>
            )}
          </div>
          <button
            type="submit"
            style={{
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: C.blue, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            검색
          </button>
        </form>

        {/* Search results count */}
        {searchQuery && searchResults.size > 0 && (
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: C.dim, fontSize: 11 }}>
              {searchResults.size}개 결과:
            </span>
            {Array.from(searchResults).slice(0, 10).map(word => {
              const wp = WORDS.find(w => w.word === word)!;
              return (
                <button
                  key={word}
                  onClick={() => handleWordClick(word)}
                  style={{
                    padding: '2px 8px', borderRadius: 6,
                    background: `${CATEGORY_COLORS[wp.category]}15`,
                    border: `1px solid ${CATEGORY_COLORS[wp.category]}30`,
                    color: CATEGORY_COLORS[wp.category],
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {word}
                </button>
              );
            })}
            {searchResults.size > 10 && (
              <span style={{ color: C.dim, fontSize: 10 }}>... +{searchResults.size - 10}</span>
            )}
          </div>
        )}

        {/* Hint */}
        <div style={{
          marginTop: 8, textAlign: 'center',
          color: C.dim, fontSize: 11, lineHeight: 1.6,
        }}>
          &#x1F4A1; 단어(별)를 클릭하면 가장 가까운 이웃 단어들이 연결선으로 표시됩니다.
          벡터 연산 모드에서 &quot;왕 - 남자 + 여자 = 여왕&quot;을 확인해 보세요!
        </div>
      </div>
    </div>
  );
}
