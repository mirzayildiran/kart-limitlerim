import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const SRC = ['src/**/*.{ts,tsx}'];

export default tseslint.config(
  {
    ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'legacy/**'],
  },
  {
    files: SRC,
    extends: [tseslint.configs.recommended],
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Same convention as TypeScript's noUnusedParameters: a leading underscore marks an intentional unused arg.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          'minimumDescriptionLength': 3,
        },
      ],

      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name=/^(alert|confirm|prompt)$/]',
          message: 'alert/confirm/prompt yok. Geri dönüşsüz işlem için ConfirmButton kullan.',
        },
        {
          selector:
            "CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt)$/]",
          message: 'alert/confirm/prompt yok. Geri dönüşsüz işlem için ConfirmButton kullan.',
        },
        {
          selector:
            "CallExpression[callee.property.name='sort'][callee.object.property.name='value']",
          message: 'Sinyal dizisini yerinde sıralama; kopyala: [...x.value].sort()',
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(reverse|splice)$/][callee.object.property.name='value']",
          message: 'Sinyal dizisini yerinde değiştirme; kopyala: [...x.value] üzerinde işlem yap.',
        },
      ],

      // Preact uses class/for; the Field component wires ids itself, so label association is not linted.
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
    },
  },
);
