module.exports = {
  extends: [
    './eslint-preset.js',
    'next/core-web-vitals',
    'plugin:react/recommended',
  ],
  plugins: ['react'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
  },
};
