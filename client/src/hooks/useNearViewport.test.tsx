import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useNearViewport } from "@/hooks/useNearViewport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeIntersectionObserver {
  static instance: FakeIntersectionObserver | null = null;
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instance = this;
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting, target: document.createElement("div") } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function Probe() {
  const { elementRef, nearViewport } = useNearViewport<HTMLDivElement>();
  return <div ref={elementRef} data-testid="state">{nearViewport ? "loaded" : "deferred"}</div>;
}

describe("useNearViewport", () => {
  const originalIntersectionObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    cleanup();
    globalThis.IntersectionObserver = originalIntersectionObserver;
    FakeIntersectionObserver.instance = null;
  });

  it("defers loading until the element approaches the viewport", () => {
    render(<Probe />);

    expect(screen.getByTestId("state").textContent).toBe("deferred");
    expect(FakeIntersectionObserver.instance?.observe).toHaveBeenCalledTimes(1);

    act(() => FakeIntersectionObserver.instance?.trigger(true));

    expect(screen.getByTestId("state").textContent).toBe("loaded");
    expect(FakeIntersectionObserver.instance?.unobserve).toHaveBeenCalledTimes(1);
  });

  it("loads immediately when IntersectionObserver is unavailable", () => {
    globalThis.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;

    render(<Probe />);

    expect(screen.getByTestId("state").textContent).toBe("loaded");
  });
});
