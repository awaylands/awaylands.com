const globals = require('globals');

module.exports = [{
  files: ['src/javascripts/**/*.js'],
  languageOptions: {
    ecmaVersion: 2022,
    globals: {
      ...globals.browser,
      ...globals.node
    },
    sourceType: 'module'
  },
  rules: {
    complexity: ['warn', 20],
    curly: ['error', 'all'],
    eqeqeq: 'error',
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-new': 'error',
    'no-undef': 'error',
    'no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
    'no-var': 'error',
    'prefer-const': 'error'
  }
}];
