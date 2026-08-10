import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const outputDir = resolve(process.cwd(), 'public', 'fonts');
mkdirSync(outputDir, { recursive: true });

const fonts = {
  'report-arabic-regular.woff': '@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff',
  'report-arabic-bold.woff': '@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff',
  'report-latin-regular.woff': '@fontsource/noto-sans-arabic/files/noto-sans-arabic-latin-400-normal.woff',
  'report-latin-bold.woff': '@fontsource/noto-sans-arabic/files/noto-sans-arabic-latin-700-normal.woff',
};

for (const [fileName, packagePath] of Object.entries(fonts)) {
  copyFileSync(require.resolve(packagePath), resolve(outputDir, fileName));
}

