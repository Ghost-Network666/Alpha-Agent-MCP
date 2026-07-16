#!/usr/bin/env tsx
/**
 * Checks whether Polymarket has any recorded trades/volume against the
 * builder code hardcoded in src/config/builder-code.ts. This is the one
 * fact no static code review can establish — attribution only exists if
 * Polymarket's backend has this exact code registered and is crediting
 * volume to it. Public endpoints only; no credentials required.
 *
 * Usage: npm run verify-builder-code
 */
import { createPublicClient } from '@polymarket/client';
import { listBuilderTrades, fetchBuilderVolume, listBuilderLeaderboard } from '@polymarket/client/actions';
import { BUILDER_CODE } from '../src/config/builder-code.js';

async function main() {
  console.log(`Checking builder code: ${BUILDER_CODE}\n`);
  const client = createPublicClient();

  console.log('-- listBuilderTrades (public, filtered by this exact code) --');
  try {
    const paginator = listBuilderTrades(client, { builderCode: BUILDER_CODE as any });
    const page = await paginator.firstPage();
    const trades = page.items ?? [];
    if (trades.length === 0) {
      console.log('No trades found for this builder code. Either it has never been used to place a');
      console.log('filled order, or it is not the code Polymarket has registered for this account.');
    } else {
      console.log(`Found ${trades.length} trade(s) on the first page. Sample:`);
      console.log(JSON.stringify(trades[0], null, 2));
    }
  } catch (err) {
    console.log(`Request failed: ${(err as Error).message}`);
    console.log('(A UserInputError here often means the code is not recognized by Polymarket at all.)');
  }

  console.log('\n-- fetchBuilderVolume (requires BUILDER_API_KEY/SECRET/PASSPHRASE auth headers) --');
  if (!process.env.BUILDER_API_KEY || !process.env.BUILDER_SECRET || !process.env.BUILDER_PASSPHRASE) {
    console.log('Skipped: BUILDER_API_KEY / BUILDER_SECRET / BUILDER_PASSPHRASE not set in env.');
    console.log('Set these (from your Polymarket builder registration) to cross-check volume tied');
    console.log('to your authenticated builder identity, independent of the hardcoded code above.');
  } else {
    try {
      const volume = await fetchBuilderVolume(client, { timePeriod: 'ALL' } as any);
      console.log(JSON.stringify(volume, null, 2));
    } catch (err) {
      console.log(`Request failed: ${(err as Error).message}`);
    }
  }

  console.log('\n-- listBuilderLeaderboard (sanity check the endpoint itself is reachable) --');
  try {
    const paginator = listBuilderLeaderboard(client, {} as any);
    const page = await paginator.firstPage();
    console.log(`Leaderboard reachable, ${(page.items ?? []).length} entries on first page.`);
  } catch (err) {
    console.log(`Request failed: ${(err as Error).message}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
