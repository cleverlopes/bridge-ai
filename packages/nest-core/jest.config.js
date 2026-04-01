/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@bridge-ai/gsd-sdk$': '<rootDir>/__mocks__/gsd-sdk.ts',
    '^@bridge-ai/bridge-sdk$': '<rootDir>/__mocks__/bridge-sdk.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageDirectory: '../coverage',
  collectCoverageFrom: [
    'module/ksm/**/*.ts',
    'module/plan/**/*.ts',
    'module/brain/**/*.ts',
    'module/metrics/**/*.ts',
    'module/obsidian/**/*.ts',
    'module/health/**/*.ts',
    'module/project/project.service.ts',
    '!**/*.module.ts',
    '!**/index.ts',
    '!**/*.entity.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};

module.exports = config;
