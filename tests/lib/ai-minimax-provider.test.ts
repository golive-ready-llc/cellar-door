import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.DATABASE_URL = "postgresql://stub";

import { OpenAICompatibleProvider } from "@/lib/ai/deepseek";
import { ProviderRouter } from "@/lib/ai/provider-router";

const slot = (provider: string, overrides: Record<string, string> = {}) =>
  ({ provider, apiKey: "k", model: "", baseUrl: "", ...overrides }) as never;
const emptySlot = { provider: "", apiKey: "", model: "", baseUrl: "" };

function okJson(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

function sse(chunks: string[]) {
  const body = chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n`).join("") + "data: [DONE]\n";
  return new Response(body, { status: 200 });
}

describe("MiniMax provider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => okJson('{"name":"Test Wine"}'));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("scans a label through the router at MiniMax's default endpoint", async () => {
    const router = new ProviderRouter({
      text: emptySlot, textFailover: emptySlot,
      vision: slot("minimax", { model: "MiniMax-M3.1-Flash" }), visionFailover: emptySlot,
      enabled: true,
    } as never);
    const result = await router.scanLabel("AAAA", "image/jpeg");
    expect(result.name).toBe("Test Wine");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // An empty base URL must not fall through to the Deepseek default.
    expect(url).toBe("https://api.minimax.io/v1/chat/completions");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("MiniMax-M3.1-Flash");
    expect(body.messages[1].content[0].image_url.url).toBe("data:image/jpeg;base64,AAAA");
  });

  it("strips inline <think> reasoning before parsing JSON", async () => {
    // MiniMax-M3 puts its reasoning in `content`, and the reasoning itself
    // quotes the JSON — so the greedy {...} fallback would span both copies.
    fetchMock.mockResolvedValueOnce(okJson(
      '<think>Output {"name":"draft"}. Ensure only JSON.</think>\n\n{"name":"Château Margaux"}'));
    const p = new OpenAICompatibleProvider({ config: slot("minimax", { model: "MiniMax-M3" }), label: "minimax" });
    expect((await p.searchWine("margaux")).name).toBe("Château Margaux");
  });

  it("strips inline <think> reasoning from chat replies", async () => {
    fetchMock.mockResolvedValueOnce(okJson("<think>They want a pairing.</think>\n\nTry a Barolo."));
    const p = new OpenAICompatibleProvider({ config: slot("minimax"), label: "minimax" });
    expect(await p.chat("sys", [{ role: "user", content: "hi" }])).toBe("Try a Barolo.");
  });

  it("hides <think> reasoning from streamed chat, even split across chunks", async () => {
    fetchMock.mockResolvedValueOnce(sse(["<thi", "nk>planning the", " answer</th", "ink>\n\nTry a ", "Barolo."]));
    const p = new OpenAICompatibleProvider({ config: slot("minimax"), label: "minimax" });
    let out = "";
    for await (const chunk of p.chatStream("sys", [{ role: "user", content: "hi" }])) out += chunk;
    expect(out).toBe("Try a Barolo.");
  });

  it("streams normally when there is no reasoning block", async () => {
    fetchMock.mockResolvedValueOnce(sse(["Try a ", "Barolo."]));
    const p = new OpenAICompatibleProvider({ config: slot("deepseek"), label: "deepseek" });
    let out = "";
    for await (const chunk of p.chatStream("sys", [{ role: "user", content: "hi" }])) out += chunk;
    expect(out).toBe("Try a Barolo.");
  });

  it("still defaults Deepseek to its own endpoint", async () => {
    const p = new OpenAICompatibleProvider({ config: slot("deepseek", { model: "deepseek-flash" }), label: "deepseek" });
    await p.searchWine("anything");
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("https://api.deepseek.com/v1/chat/completions");
  });
});
