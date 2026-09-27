import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

/**
 * Regression: loading was cleared at the FIRST stream chunk, which re-enabled
 * the input and quick actions while the reply was still streaming. A second
 * message sent in that window appended to the transcript and was then deleted
 * by the stream's positional `slice(0, -1)` update — the user's question
 * vanished and the transcript garbled (both messages were still charged).
 * loading must stay true for the whole stream; the finally clears it.
 */

vi.mock("@/hooks/use-checkout", () => ({
  useCheckout: () => ({ startCheckout: vi.fn(), checkoutLoading: false }),
}));

import { CellarChat } from "@/components/chat/cellar-chat";

function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    stream,
    emit: (text: string) =>
      controller.enqueue(new TextEncoder().encode(text)),
    close: () => controller.close(),
  };
}

let stream: ReturnType<typeof controlledStream>;

beforeEach(() => {
  stream = controlledStream();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, body: stream.stream }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function openChat() {
  render(<CellarChat wines={[]} hasAI />);
  // The FAB toggles on pointerup (click-vs-drag discrimination), not onClick;
  // a bare pointerup with no prior pointerdown reads as a click.
  fireEvent.pointerUp(screen.getByRole("button", { name: /open chat/i }));
  return screen.getByPlaceholderText("Ask your sommelier...");
}

describe("CellarChat streaming", () => {
  it("keeps the input disabled until the stream finishes, not just until the first chunk", async () => {
    const input = openChat();

    fireEvent.change(input, { target: { value: "first question" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      stream.emit("Hello ");
    });
    // getByText trims/normalizes — "Hello " matches as "Hello".
    expect(await screen.findByText("Hello")).toBeInTheDocument();

    // Mid-stream: the reply is visible but still streaming — sending must
    // stay blocked so the positional update can't delete a new message.
    expect(input).toBeDisabled();

    await act(async () => {
      stream.emit("there");
      stream.close();
    });

    await waitFor(() => expect(input).not.toBeDisabled());
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("first question")).toBeInTheDocument();
  });
});
