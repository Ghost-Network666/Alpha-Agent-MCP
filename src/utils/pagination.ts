import type { Paginated, Page } from '@polymarket/client';
import { logger } from './logger.js';
import { withErrorHandling } from './errors.js';

export interface PaginationOptions {
  maxPages?: number;
  onPage?: (page: Page<unknown>, pageNum: number) => void | Promise<void>;
}

/**
 * Collect all items from a Paginated iterator (up to maxPages).
 * Production-safe with logging.
 */
export async function collectAll<T>(
  paginator: Paginated<T[]>,
  options: PaginationOptions = {}
): Promise<T[]> {
  const { maxPages = 100, onPage } = options;
  const items: T[] = [];
  let pageNum = 0;

  for await (const page of paginator) {
    pageNum += 1;
    items.push(...page.items);
    if (onPage) await onPage(page as Page<unknown>, pageNum);
    logger.debug(`Pagination page ${pageNum}`, { itemCount: page.items.length, cursor: page.nextCursor });
    if (pageNum >= maxPages) {
      logger.warn('Pagination hit maxPages limit', { maxPages });
      break;
    }
  }
  return items;
}

/**
 * Get first page only (convenience).
 */
export async function firstPage<T>(paginator: Paginated<T[]>): Promise<Page<T[]>> {
  return withErrorHandling(() => paginator.firstPage(), 'pagination.firstPage');
}

/**
 * Iterate pages with optional callback. Use for large discovery jobs.
 */
export async function forEachPage<T>(
  paginator: Paginated<T[]>,
  callback: (page: Page<T[]>, pageNum: number) => void | Promise<void>,
  maxPages = 500
): Promise<void> {
  let pageNum = 0;
  for await (const page of paginator) {
    pageNum++;
    await callback(page, pageNum);
    if (pageNum >= maxPages) break;
  }
}

/**
 * Resume pagination from a cursor (typed helper).
 */
export function resumeFrom<T>(paginator: Paginated<T[]>, cursor: string) {
  return paginator.from(cursor as any);
}
