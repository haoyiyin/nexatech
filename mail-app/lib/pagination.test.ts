import { describe, expect, it } from "vitest";
import {
  INBOX_PAGE_SIZE,
  clampPage,
  getPaginationRange,
  getPaginationState,
  getTotalPages,
  parsePageParam,
} from "./pagination";

describe("pagination helpers", () => {
  describe("parsePageParam", () => {
    it("defaults to page 1 when the param is missing", () => {
      expect(parsePageParam(undefined)).toBe(1);
    });

    it("returns parsed positive integers", () => {
      expect(parsePageParam("3")).toBe(3);
    });

    it("falls back to page 1 for zero, negative, or invalid values", () => {
      expect(parsePageParam("0")).toBe(1);
      expect(parsePageParam("-2")).toBe(1);
      expect(parsePageParam("abc")).toBe(1);
    });

    it("supports array search param values", () => {
      expect(parsePageParam(["2", "3"])).toBe(2);
    });
  });

  describe("getTotalPages", () => {
    it("returns one page for empty inboxes", () => {
      expect(getTotalPages(0, INBOX_PAGE_SIZE)).toBe(1);
    });

    it("rounds up for partial last pages", () => {
      expect(getTotalPages(21, INBOX_PAGE_SIZE)).toBe(2);
    });
  });

  describe("clampPage", () => {
    it("clamps below the first page", () => {
      expect(clampPage(0, 50, INBOX_PAGE_SIZE)).toBe(1);
    });

    it("clamps above the last page", () => {
      expect(clampPage(9, 21, INBOX_PAGE_SIZE)).toBe(2);
    });
  });

  describe("getPaginationRange", () => {
    it("builds the correct range for the current page", () => {
      expect(getPaginationRange(1, INBOX_PAGE_SIZE)).toEqual({ from: 0, to: 19 });
      expect(getPaginationRange(2, INBOX_PAGE_SIZE)).toEqual({ from: 20, to: 39 });
    });
  });

  describe("getPaginationState", () => {
    it("marks first-page inboxes without a previous page", () => {
      expect(getPaginationState(1, 21, INBOX_PAGE_SIZE)).toEqual({
        currentPage: 1,
        totalPages: 2,
        hasPreviousPage: false,
        hasNextPage: true,
      });
    });

    it("marks last-page inboxes without a next page", () => {
      expect(getPaginationState(2, 21, INBOX_PAGE_SIZE)).toEqual({
        currentPage: 2,
        totalPages: 2,
        hasPreviousPage: true,
        hasNextPage: false,
      });
    });

    it("keeps empty inboxes on page one", () => {
      expect(getPaginationState(4, 0, INBOX_PAGE_SIZE)).toEqual({
        currentPage: 1,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      });
    });
  });
});
