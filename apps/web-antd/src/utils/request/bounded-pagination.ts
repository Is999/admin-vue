import { $t } from '#/locales';

// BACKEND_MAX_PAGE_SIZE 表示后台通用分页入口允许的单页最大条数。
export const BACKEND_MAX_PAGE_SIZE = 100;

export interface BoundedPageResult<T> {
  list: T[];
  total: number;
}

export interface BoundedPaginationOptions<T> {
  fetchPage: (page: number, pageSize: number) => Promise<BoundedPageResult<T>>;
  getItemKey: (item: T) => number | string;
  maxItems: number;
  maxPages: number;
  pageSize?: number;
}

interface BoundedPagePlan {
  maxItems: number;
  maxPages: number;
  pageSize: number;
}

// resolveBoundedPageCount 校验总量和分页边界，并返回本次允许请求的页数。
export function resolveBoundedPageCount(total: number, plan: BoundedPagePlan) {
  const { maxItems, maxPages, pageSize } = plan;
  if (
    !Number.isInteger(total) ||
    total < 0 ||
    !Number.isInteger(pageSize) ||
    pageSize <= 0 ||
    pageSize > BACKEND_MAX_PAGE_SIZE ||
    !Number.isInteger(maxItems) ||
    maxItems <= 0 ||
    !Number.isInteger(maxPages) ||
    maxPages <= 0
  ) {
    throw new Error($t('business.message.boundedPaginationInvalid'));
  }
  const pageCount = Math.ceil(total / pageSize);
  if (total > maxItems || pageCount > maxPages) {
    throw new Error(
      $t('business.message.boundedPaginationLimitExceeded', [
        String(maxItems),
        String(maxPages),
      ]),
    );
  }
  return pageCount;
}

// fetchBoundedPages 在明确总量和页数上限内聚合分页结果；任何缺页、重复或总量漂移都直接失败。
export async function fetchBoundedPages<T>(
  options: BoundedPaginationOptions<T>,
) {
  const pageSize = options.pageSize ?? BACKEND_MAX_PAGE_SIZE;
  const firstPage = await options.fetchPage(1, pageSize);
  if (!firstPage || !Array.isArray(firstPage.list)) {
    throw new Error($t('business.message.boundedPaginationInvalid'));
  }
  const expectedTotal = firstPage.total;
  const pageCount = resolveBoundedPageCount(expectedTotal, {
    maxItems: options.maxItems,
    maxPages: options.maxPages,
    pageSize,
  });
  const items: T[] = [];
  const itemKeys = new Set<number | string>();

  // appendPage 校验单页结构和唯一键，禁止用不完整数据继续渲染树或收件人列表。
  function appendPage(response: BoundedPageResult<T>) {
    if (
      !response ||
      !Array.isArray(response.list) ||
      response.total !== expectedTotal ||
      response.list.length > pageSize
    ) {
      throw new Error($t('business.message.boundedPaginationInvalid'));
    }
    for (const item of response.list) {
      const itemKey = options.getItemKey(item);
      if (
        (typeof itemKey !== 'number' && typeof itemKey !== 'string') ||
        String(itemKey).trim() === '' ||
        itemKeys.has(itemKey)
      ) {
        throw new Error($t('business.message.boundedPaginationDuplicate'));
      }
      itemKeys.add(itemKey);
      items.push(item);
    }
    if (items.length > expectedTotal || items.length > options.maxItems) {
      throw new Error($t('business.message.boundedPaginationInvalid'));
    }
  }

  appendPage(firstPage);
  for (let page = 2; page <= pageCount; page += 1) {
    appendPage(await options.fetchPage(page, pageSize));
  }
  if (items.length !== expectedTotal) {
    throw new Error(
      $t('business.message.boundedPaginationIncomplete', [
        String(expectedTotal),
        String(items.length),
      ]),
    );
  }
  return items;
}
