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
}, {
  files: ['scripts/**/*.js'],
  ignores: ['scripts/post-publisher.js'],
  languageOptions: {ecmaVersion: 2024, sourceType: 'commonjs', globals: globals.node},
  rules: {
    'no-debugger': 'error',
    'no-undef': 'error',
    'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_'}],
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-const-assign': 'error'
  }
}, {
  files: ['tools/**/*.js', 'scripts/post-publisher.js'],
  languageOptions: {ecmaVersion: 2024, sourceType: 'script', globals: {...globals.browser, chrome: 'readonly'}},
  rules: {'no-debugger': 'error', 'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-const-assign': 'error'}
}];
