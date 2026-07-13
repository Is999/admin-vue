import { describe, expect, it, vi } from 'vitest';

import {
  fetchBoundedPages,
  resolveBoundedPageCount,
} from '../bounded-pagination';

describe('bounded pagination', () => {
  it('resolves page count only within explicit limits', () => {
    expect(
      resolveBoundedPageCount(230, {
        maxItems: 300,
        maxPages: 3,
        pageSize: 100,
      }),
    ).toBe(3);
    expect(() =>
      resolveBoundedPageCount(301, {
        maxItems: 300,
        maxPages: 4,
        pageSize: 100,
      }),
    ).toThrow(/boundedPaginationLimitExceeded/);
    expect(() =>
      resolveBoundedPageCount(1, {
        maxItems: 10,
        maxPages: 1,
        pageSize: 101,
      }),
    ).toThrow(/boundedPaginationInvalid/);
  });

  it('aggregates complete pages with the backend page-size boundary', async () => {
    const allItems = Array.from({ length: 230 }, (_, index) => ({
      id: index + 1,
    }));
    const fetchPage = vi.fn(async (page: number, pageSize: number) => ({
      list: allItems.slice((page - 1) * pageSize, page * pageSize),
      total: allItems.length,
    }));

    await expect(
      fetchBoundedPages({
        fetchPage,
        getItemKey: (item) => item.id,
        maxItems: 300,
        maxPages: 3,
      }),
    ).resolves.toEqual(allItems);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1, 100);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 3, 100);
  });

  it('fails closed on duplicate, incomplete, or drifting pages', async () => {
    await expect(
      fetchBoundedPages({
        fetchPage: async (page) => ({
          list: page === 1 ? [{ id: 1 }] : [{ id: 1 }],
          total: 2,
        }),
        getItemKey: (item) => item.id,
        maxItems: 2,
        maxPages: 2,
        pageSize: 1,
      }),
    ).rejects.toThrow(/boundedPaginationDuplicate/);

    await expect(
      fetchBoundedPages({
        fetchPage: async () => ({ list: [{ id: 1 }], total: 2 }),
        getItemKey: (item) => item.id,
        maxItems: 2,
        maxPages: 1,
        pageSize: 2,
      }),
    ).rejects.toThrow(/boundedPaginationIncomplete/);

    await expect(
      fetchBoundedPages({
        fetchPage: async (page) => ({
          list: [{ id: page }],
          total: page === 1 ? 2 : 3,
        }),
        getItemKey: (item) => item.id,
        maxItems: 3,
        maxPages: 3,
        pageSize: 1,
      }),
    ).rejects.toThrow(/boundedPaginationInvalid/);
  });
});
