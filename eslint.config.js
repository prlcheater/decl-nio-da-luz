import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Config "flat" (ESLint 9). Um bloco para os arquivos JS/JSX (React Bits, copiados
// do registry) e outro para o código TS/TSX do app. O script `npm run lint` roda
// `eslint .` — veja package.json.
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'scripts', 'vite.config.ts', 'vitest.config.ts'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      // O wrapper do tseslint para esta regra da base crasha com a versão de
      // ESLint em uso; o type-check do tsc já cobre expressões sem efeito.
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
)
