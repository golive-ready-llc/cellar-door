import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * SSRF guard tests. The module imports `dns/promises` to resolve hostnames,
 * which we stub so we never hit real DNS during the test run. The mock is
 * registered before importing the SUT (vi.mock is hoisted).
 */

const lookupMock = vi.fn();
vi.mock("dns/promises", () => {
  const lookup = (...args: unknown[]) => lookupMock(...args);
  return {
    // Re-export under both named and default to satisfy Vitest's CJS-default
    // shim regardless of how the SUT imports the module.
    lookup,
    default: { lookup },
  };
});

import { validateHaUrl } from "@/lib/ssrf-guard";

describe("validateHaUrl", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    delete process.env.HA_ALLOW_HTTP;
  });

  afterEach(() => {
    delete process.env.HA_ALLOW_HTTP;
  });

  it("rejects a malformed URL", async () => {
    await expect(validateHaUrl("not-a-url")).rejects.toThrow(/invalid url/i);
  });

  it("rejects http:// when HA_ALLOW_HTTP is unset", async () => {
    await expect(validateHaUrl("http://example.com")).rejects.toThrow(/disallowed protocol/i);
  });

  it("accepts http:// when HA_ALLOW_HTTP=true and host resolves to a public IP", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    lookupMock.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    const url = await validateHaUrl("http://homeassistant.example");
    expect(url.hostname).toBe("homeassistant.example");
  });

  it("rejects loopback hostname (resolves to 127.0.0.1)", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(validateHaUrl("http://localhost")).rejects.toThrow(/blocked/i);
  });

  it("rejects literal 127.0.0.1 without DNS lookup", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    await expect(validateHaUrl("http://127.0.0.1")).rejects.toThrow(/blocked ip range/i);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects 10.0.0.0/8 literal", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    await expect(validateHaUrl("http://10.0.0.5")).rejects.toThrow(/blocked ip range/i);
  });

  it("rejects 172.16.0.0/12 literal", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    await expect(validateHaUrl("http://172.16.0.1")).rejects.toThrow(/blocked ip range/i);
  });

  it("rejects 192.168.0.0/16 literal", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    await expect(validateHaUrl("http://192.168.1.1")).rejects.toThrow(/blocked ip range/i);
  });

  it("rejects AWS/GCP metadata 169.254.169.254", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    await expect(validateHaUrl("http://169.254.169.254")).rejects.toThrow(/blocked ip range/i);
  });

  it("rejects IPv6 loopback [::1]", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    await expect(validateHaUrl("http://[::1]")).rejects.toThrow(/blocked ipv6 range/i);
  });

  it("rejects IPv6 link-local [fe80::1]", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    await expect(validateHaUrl("http://[fe80::1]")).rejects.toThrow(/blocked ipv6 range/i);
  });

  it("rejects IPv4-mapped IPv6 literals, which embed a loopback/metadata IPv4", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    await expect(validateHaUrl("http://[::ffff:127.0.0.1]")).rejects.toThrow(/blocked ipv6 range/i);
    await expect(validateHaUrl("http://[::ffff:169.254.169.254]")).rejects.toThrow(
      /blocked ipv6 range/i
    );
  });

  it("rejects the hex and fully-expanded spellings of an IPv4-mapped literal", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    await expect(validateHaUrl("http://[::ffff:7f00:1]")).rejects.toThrow(/blocked ipv6 range/i);
    await expect(validateHaUrl("http://[0:0:0:0:0:ffff:127.0.0.1]")).rejects.toThrow(
      /blocked ipv6 range/i
    );
  });

  it("accepts an IPv4-mapped literal that embeds a public IPv4", async () => {
    process.env.HA_ALLOW_HTTP = "true";
    const url = await validateHaUrl("http://[::ffff:8.8.8.8]");
    expect(url.protocol).toBe("http:");
  });

  it("accepts an https hostname that resolves to a public IPv4", async () => {
    lookupMock.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
    const url = await validateHaUrl("https://ha.example.com");
    expect(url.protocol).toBe("https:");
    expect(lookupMock).toHaveBeenCalledWith("ha.example.com", { all: true });
  });

  it("rejects an https hostname that resolves to ANY blocked IP (defense vs DNS rebinding)", async () => {
    // Public + private mixed — the guard should block on the private one.
    lookupMock.mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await expect(validateHaUrl("https://rebind.example")).rejects.toThrow(/resolves to blocked/i);
  });

  it("rejects when DNS lookup throws", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(validateHaUrl("https://nope.example")).rejects.toThrow(/dns lookup failed/i);
  });
});
