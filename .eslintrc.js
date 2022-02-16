module.exports = {
    extends: ['@shm-open/eslint-config-bundle'],
    rules: {
        // temp disables - will be removed once we have all js files converted to ts
        '@typescript-eslint/no-var-requires': 'off',
        'import/no-unused-modules': 'off',

        '@typescript-eslint/naming-convention': [
            'error',
            {
                selector: 'default',
                format: ['camelCase', 'PascalCase', 'UPPER_CASE', 'snake_case'],
                leadingUnderscore: 'allowSingleOrDouble',
            },
            {
                selector: 'enum',
                format: ['PascalCase'],
            },
            {
                selector: 'enumMember',
                format: ['UPPER_CASE'],
            },
            {
                selector: 'variableLike',
                format: ['camelCase', 'PascalCase'],
                leadingUnderscore: 'allow',
            },
            {
                selector: 'typeLike',
                format: ['PascalCase'],
            },
            {
                selector: 'objectLiteralProperty',
                format: ['camelCase', 'snake_case', 'UPPER_CASE', 'PascalCase'],
            },
        ],
    },
};
