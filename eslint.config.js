// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/functions/**'],
  },
  {
    // Arquivos de config/scripts em CommonJS rodam em Node, nao no bundle RN.
    files: ['*.config.js', '*.config.cjs', 'jest.setup.js', 'scripts/**/*.js', 'plugins/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['jest.setup.js', '__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
]);
