import { describe, expect, it } from "vitest";
import { browserPlayerViewportStyle } from "./screen-orientation";

describe("browserPlayerViewportStyle", () => {
  it("returns full size for landscape", () => {
    expect(browserPlayerViewportStyle("landscape")).toEqual({
      width: "100%",
      height: "100%",
    });
  });

  it("rotates portrait with centered translate", () => {
    expect(browserPlayerViewportStyle("portrait").transform).toBe(
      "translate(-50%, -50%) rotate(90deg)",
    );
  });
});
