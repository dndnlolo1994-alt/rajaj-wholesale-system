import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // الواجهات الحالية تعيد ضبط نماذج الحوارات والبحث عند الفتح عمدًا.
      'react-hooks/set-state-in-effect': 'off',
      // قاعدة React Compiler محافظة جدًا مع دوال الخرائط التي تغلق فوق refs.
      'react-hooks/refs': 'off',
    },
  },
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);
