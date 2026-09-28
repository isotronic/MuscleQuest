module.exports = {
  extends: ["expo", "prettier"],
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": [
      "warn",
      {
        endOfLine: "auto",
      },
    ],
    "expo/use-dom-exports": "off",
    // Stored timestamps are UTC without an offset, and an ISO date-time with no
    // offset is parsed as local time. utils/dates.ts is the single authority.
    "no-restricted-syntax": [
      "error",
      {
        selector:
          'NewExpression[callee.name="Date"] > MemberExpression[property.name="date_completed"]',
        message:
          "Use parseDbTimestamp from @/utils/dates for the instant, or the row's local_date for the training day. new Date() reads a stored UTC value as local time.",
      },
      {
        selector:
          'NewExpression[callee.name="Date"] > MemberExpression[property.name="recorded_at"]',
        message:
          "Use parseDbTimestamp from @/utils/dates for the instant, or the row's local_date for the training day. new Date() reads a stored UTC value as local time.",
      },
    ],
  },
  overrides: [
    {
      // jest.mock factories and isolated module loads require() by design
      files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ],
};
