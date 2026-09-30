import { formatTimeAgo } from "../relativeTime";

// @lingui/core ships ESM that Jest does not transform.
jest.mock("@lingui/core", () => ({ i18n: { locale: "en" } }));
const mockI18n = jest.requireMock("@lingui/core").i18n as { locale: string };

const twoDaysAgo = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

describe("formatTimeAgo", () => {
  const activate = (locale: string) => {
    mockI18n.locale = locale;
  };
  afterEach(() => activate("en"));

  it.each([
    ["en", "2 days ago"],
    ["de", "vor 2 Tagen"],
    ["es", "hace 2 días"],
    ["fr", "il y a 2 jours"],
  ])("formats in the active app locale (%s)", (locale, expected) => {
    activate(locale);
    expect(formatTimeAgo(twoDaysAgo())).toBe(expected);
  });

  it("falls back to English for an unknown locale", () => {
    activate("xx");
    expect(formatTimeAgo(twoDaysAgo())).toBe("2 days ago");
  });
});
