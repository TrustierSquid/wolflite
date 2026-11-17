module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest"
  },
  moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
  // Image imports (e.g. the login illustrations) become a plain string in tests
  moduleNameMapper: {
    "\\.(svg|png|jpe?g|gif|webp)$": "<rootDir>/tests/fileMock.cjs",
  },
};
