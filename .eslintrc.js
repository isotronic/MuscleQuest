// Stored timestamps are UTC without an offset, and an ISO date-time with no
// offset is parsed as local time. utils/dates.ts is the single authority.
const dateRestrictions = [
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
];

// Conversion factors live in utils/units.ts only; copies drifted apart before.
const unitRestrictions = [
  "2.2046226",
  "0.45359237",
  "3.28084",
  "0.3048",
  "2.54",
].map((value) => ({
  selector: `Literal[value=${value}]`,
  message: "Use the helpers and constants in @/utils/units.",
}));

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
    "no-restricted-syntax": ["error", ...dateRestrictions, ...unitRestrictions],
  },
  overrides: [
    {
      // jest.mock factories and isolated module loads require() by design
      files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
      },
    },
    {
      // The one place the conversion factors are defined.
      files: ["utils/units.ts"],
      rules: {
        "no-restricted-syntax": ["error", ...dateRestrictions],
      },
    },
  ],
};
