import { describe, expect, it } from "vitest";
import { reorderList } from "@/lib/reorder-list";

describe("reorderList", () => {
  it("moves an item forward", () => {
    expect(reorderList(["a", "b", "c", "d"], 1, 3)).toEqual(["a", "c", "d", "b"]);
  });

  it("moves an item backward", () => {
    expect(reorderList(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns original list when indexes are invalid", () => {
    const list = ["a", "b"];
    expect(reorderList(list, -1, 1)).toBe(list);
    expect(reorderList(list, 1, 9)).toBe(list);
    expect(reorderList(list, 0, 0)).toBe(list);
  });
});
