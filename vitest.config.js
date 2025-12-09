import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Use happy-dom for fast DOM simulation
        environment: 'happy-dom',

        // Global test utilities
        globals: true,

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            exclude: [
                'node_modules/**',
                'tests/**',
                '**/*.config.js'
            ]
        },

        // Test file patterns
        include: ['tests/**/*.test.js']
    }
});
