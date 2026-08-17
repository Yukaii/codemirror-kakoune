import { DEFAULT_SETTINGS } from "../src/types";
import { isDomainEnabled, matchDomainPattern } from "../src/storage";

describe("Domain matching and storage settings", () => {
  it("matches domain patterns correctly", () => {
    expect(matchDomainPattern("github.com", "github.com")).toBe(true);
    expect(matchDomainPattern("gist.github.com", "*.github.com")).toBe(true);
    expect(matchDomainPattern("github.com", "*.github.com")).toBe(true);
    expect(matchDomainPattern("gitlab.com", "*.github.com")).toBe(false);
    expect(matchDomainPattern("any.com", "*")).toBe(true);
  });

  it("checks if domain is enabled with default settings", () => {
    expect(isDomainEnabled("github.com", DEFAULT_SETTINGS)).toBe(true);
    expect(isDomainEnabled("localhost", DEFAULT_SETTINGS)).toBe(true);
  });

  it("respects master disable switch", () => {
    const settings = { ...DEFAULT_SETTINGS, enabled: false };
    expect(isDomainEnabled("github.com", settings)).toBe(false);
  });

  it("respects blacklist", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      blacklistedDomains: ["docs.google.com", "*.banking.com"]
    };
    expect(isDomainEnabled("docs.google.com", settings)).toBe(false);
    expect(isDomainEnabled("app.banking.com", settings)).toBe(false);
    expect(isDomainEnabled("github.com", settings)).toBe(true);
  });

  it("respects whitelist", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      whitelistedDomains: ["github.com", "*.gitlab.com"]
    };
    expect(isDomainEnabled("github.com", settings)).toBe(true);
    expect(isDomainEnabled("sub.gitlab.com", settings)).toBe(true);
    expect(isDomainEnabled("other.com", settings)).toBe(false);
  });

  it("prioritizes siteOverrides over whitelist/blacklist", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      blacklistedDomains: ["github.com"],
      siteOverrides: { "github.com": true, "other.com": false }
    };
    expect(isDomainEnabled("github.com", settings)).toBe(true);
    expect(isDomainEnabled("other.com", settings)).toBe(false);
  });
});
