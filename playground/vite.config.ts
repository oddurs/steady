import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    alias: [
      {
        find: '@oddurs/steady/react',
        replacement: fileURLToPath(
          new URL('../src/react/index.tsx', import.meta.url),
        ),
      },
      {
        find: '@oddurs/steady',
        replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
      },
    ],
  },
});
