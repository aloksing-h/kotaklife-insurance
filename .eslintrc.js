module.exports = {
  root: true,
  extends: [
    'airbnb-base',
    'plugin:json/recommended',
    'plugin:xwalk/recommended',
  ],
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'import/extensions': ['error', { js: 'always' }], // require js file extensions in imports
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
    'xwalk/max-cells': ['error', {
      section: 9,
      'insight-card': 8,
      'plan-card': 9,
      'tab-panel': 6,
      'video-banner': 6,
      'result-summary-panel': 34,
      'result-summary-panel-v2': 7,
      'result-summary-with-canvas': 12,
      'calculator-metrics-grid': 30,
      'blog-listing': 5,
      'photo-gallery': 7,
      'job-listing': 20,
      'job-listing-item': 7,
      'team-profiles-item': 5,
      'search-results': 14,
      'media-center': 19,
      'media-center-campaign': 5,
    }],
  },
};
