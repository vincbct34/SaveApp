module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'react', 'react-hooks'],
    settings: {
        react: {
            version: 'detect',
        },
    },
    rules: {
        // React 17+ n'a plus besoin d'importer React
        'react/react-in-jsx-scope': 'off',
        // Autoriser any en dernier recours (à éviter)
        '@typescript-eslint/no-explicit-any': 'warn',
        // Autoriser les variables non utilisées avec underscore
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        // Hooks rules
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        // Pas de console.log en prod (warning seulement)
        'no-console': 'off',
    },
    ignorePatterns: ['dist/', 'node_modules/', '*.config.js', '*.config.cjs'],
}
