import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.claude` et `.worktrees` portent les worktrees des agents : chacun est une copie
  // complète du projet, avec son propre `tsconfig.json`. ESLint y voit une seconde racine
  // de configuration TypeScript et cesse alors de parser **tout** le dépôt. Les deux sont
  // déjà dans `.gitignore` ; les ignorer ici aussi est ce qui garde `npm run lint`
  // utilisable pendant qu'une session d'agent travaille à côté.
  { ignores: ['dist', 'coverage', 'node_modules', '.claude', '.worktrees', 'android/**/build/**'] },
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
