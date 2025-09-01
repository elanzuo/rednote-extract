/**
 * Commitlint configuration for Conventional Commits
 * @see https://commitlint.js.org/#/
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New features (most important)
        'fix', // Bug fixes (most important)
        'docs', // Documentation changes
        'style', // Code style changes (formatting, missing semi colons, etc)
        'refactor', // Code refactoring without changing functionality
        'perf', // Performance improvements
        'test', // Adding or updating tests
        'build', // Build system changes (webpack, vite, etc)
        'ci', // CI configuration changes
        'chore', // Maintenance tasks (dependency updates, etc)
        'revert', // Reverting previous commits
      ],
    ],
    // 'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'type-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
    'footer-max-line-length': [2, 'always', 100],
  },
};
