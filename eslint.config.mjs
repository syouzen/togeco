import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.expo/**', 'node_modules/**', 'dist/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['pb_hooks/**/*.js'],
    languageOptions: {
      globals: { routerAdd: 'readonly', DynamicModel: 'readonly', $os: 'readonly', $http: 'readonly', $apis: 'readonly', $app: 'readonly', onRecordAfterCreateSuccess: 'readonly', cronAdd: 'readonly', console: 'readonly' }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
);
