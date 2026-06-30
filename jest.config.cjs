module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/workflows/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.workflows.json' }]
  },
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/workflows/domain/$1'
  },
  collectCoverageFrom: ['workflows/domain/**/*.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node'
};
