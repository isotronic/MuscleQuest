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

// Decimal text goes through utils/numberFormat.ts (DecimalInput or its
// helpers): a hand-written sanitiser that keeps digits and "." drops the comma
// a European keyboard types, turning 62,5 into 625.
const decimalInputRestriction = {
  selector:
    'CallExpression[callee.property.name="replace"] > Literal[regex.pattern=/(0-9|\\\\d)\\./]',
  message:
    "Use DecimalInput from @/components/ui or the helpers in @/utils/numberFormat for decimal input.",
};

// Icon-only buttons need a spoken label; AppIconButton makes it a required prop.
const iconButtonRestriction = {
  name: "react-native-paper",
  importNames: ["IconButton"],
  message:
    "Use AppIconButton from @/components/ui, which requires an accessibilityLabel.",
};

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
    "no-restricted-syntax": [
      "error",
      ...dateRestrictions,
      ...unitRestrictions,
      decimalInputRestriction,
    ],
    "no-restricted-imports": ["error", { paths: [iconButtonRestriction] }],
    // console.log is stripped from release bundles (babel.config.js); use a
    // Bugsnag breadcrumb for anything worth keeping.
    "no-console": ["warn", { allow: ["error", "warn"] }],
  },
  overrides: [
    {
      // Node scripts, config plugins and tests print to a terminal.
      files: [
        "scripts/**",
        "plugins/**",
        "rules-tests/**",
        "**/__tests__/**",
        "*.config.js",
        "*.config.ts",
      ],
      rules: {
        "no-console": "off",
      },
    },
    {
      // The wrapper that enforces the label.
      files: ["components/ui/AppIconButton.tsx"],
      rules: {
        "no-restricted-imports": "off",
      },
    },
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
        "no-restricted-syntax": [
          "error",
          ...dateRestrictions,
          decimalInputRestriction,
        ],
      },
    },
  ],
};
