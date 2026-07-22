import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.claude` porte les worktrees de l'agent : un second projet TypeScript
  // complet, dans lequel ESLint voit une deuxième racine de tsconfig et cesse
  // alors de parser **tout** le dépôt. Il est déjà dans `.gitignore`.
  { ignores: ['dist', 'coverage', 'node_modules', '.claude'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // CLAUDE.md: pas de `any`.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
