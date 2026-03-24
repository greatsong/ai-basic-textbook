// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://greatsong.github.io',
  base: '/ai-basic-textbook',
  server: { port: 4025 },
  integrations: [
    starlight({
      title: 'AI 기초',
      description: '인공지능 기초 — 고등학교 2학년 인터랙티브 웹 교재',
      defaultLocale: 'root',
      locales: {
        root: { label: '한국어', lang: 'ko' },
      },
      sidebar: [
        {
          label: 'AI의 시작',
          items: [
            { label: '1차시: 기계가 생각할 수 있는가?', slug: 'lessons/part1/lesson-01' },
            { label: '2차시: 기계가 스스로 학습할 수 있는가?', slug: 'lessons/part1/lesson-02' },
          ],
        },
        {
          label: '신경망의 비밀',
          items: [
            { label: '3차시: 모두가 포기했을 때', slug: 'lessons/part2/lesson-03' },
            { label: '4차시: 얼마나 틀렸는가', slug: 'lessons/part2/lesson-04' },
          ],
        },
        {
          label: '학습의 원리',
          items: [
            { label: '5차시: 산을 내려가는 공', slug: 'lessons/part3/lesson-05' },
            { label: '6차시: 오차를 거꾸로 보내다', slug: 'lessons/part3/lesson-06' },
          ],
        },
        {
          label: '언어를 이해하는 AI',
          items: [
            { label: '7차시: 왕에서 남자를 빼면', slug: 'lessons/part4/lesson-07' },
            { label: '8차시: 다음 단어를 맞춰보세요', slug: 'lessons/part4/lesson-08' },
          ],
        },
        {
          label: '확장 모듈',
          items: [
            { label: '9차시: AI 마일스톤 탐험', slug: 'lessons/part5/lesson-09' },
            { label: '10차시: AI의 한계를 찾아서', slug: 'lessons/part5/lesson-10' },
          ],
        },
        {
          label: '교사용 지도서',
          items: [
            { label: '[교사] 1차시: 기계가 생각할 수 있는가?', slug: 'guide/lesson-01' },
            { label: '[교사] 2차시: 기계가 스스로 학습할 수 있는가?', slug: 'guide/lesson-02' },
          ],
        },
        {
          label: '부록',
          items: [
            { label: '용어 사전', slug: 'appendix/glossary' },
            { label: '서술형 평가', slug: 'appendix/assessment' },
            { label: '참고자료', slug: 'appendix/references' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
    }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
