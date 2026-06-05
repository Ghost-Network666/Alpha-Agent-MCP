/**
 * Agent topic strings → Gamma tagSlug. Registry (gamma-tag-registry.ts) supplies tagId fast path.
 * Unknown topics still pass through as lowercase slug + live fetchTag.
 */

/** Broad categories (uppercase keys for ergonomic category= on list_* tools). */
export const CATEGORY_TAG_SLUG: Record<string, string> = {
  WEATHER: 'weather',
  CLIMATE: 'climate',
  SPORTS: 'sports',
  CRYPTO: 'crypto',
  POLITICS: 'politics',
  SCIENCE: 'science',
  ENTERTAINMENT: 'entertainment',
  TECH: 'tech',
  AI: 'ai',
  MACRO: 'macro',
  ELECTIONS: 'election',
  UK: 'uk',
  CULTURE: 'pop-culture',
  BUSINESS: 'business',
  FINANCE: 'finance',
};

/** All discover_topic / category aliases (lowercase + uppercase category keys). */
export const TOPIC_ALIASES: Record<string, string> = {
  ...CATEGORY_TAG_SLUG,

  // weather / climate
  weather: 'weather',
  climate: 'climate',
  temperature: 'temperature',
  'daily-temperature': 'daily-temperature',

  // sports
  sports: 'sports',
  sport: 'sports',
  nfl: 'nfl',
  nba: 'nba',
  mlb: 'mlb',
  nhl: 'nhl',
  soccer: 'soccer',
  football: 'nfl',
  ufc: 'ufc',
  mma: 'ufc',
  boxing: 'boxing',
  tennis: 'tennis',
  golf: 'golf',
  f1: 'f1',
  'formula-1': 'f1',
  'premier-league': 'premier-league',
  'champions-league': 'champions-league',
  'europa-league': 'europa-league',
  cricket: 'cricket',
  esports: 'esports',
  poker: 'poker',
  'college-football': 'college-football',
  'world-cup': 'world-cup',

  // crypto
  crypto: 'crypto',
  cryptocurrency: 'crypto',
  bitcoin: 'bitcoin',
  btc: 'bitcoin',
  ethereum: 'ethereum',
  eth: 'ethereum',
  solana: 'solana',
  sol: 'solana',
  altcoins: 'altcoins',
  altcoin: 'altcoins',
  defi: 'defi-app',
  nft: 'nft',
  nfts: 'nft',
  memecoin: 'memecoins',
  memecoins: 'memecoins',
  'meme-coins': 'memecoins',

  // politics / geo / macro
  politics: 'politics',
  political: 'politics',
  election: 'election',
  elections: 'election',
  trump: 'trump',
  biden: 'biden',
  congress: 'congress',
  senate: 'sentate',
  'house-races': 'house-races',
  'us-politics': 'politics',
  'us-election': 'election',
  'uk-politics': 'uk',
  uk: 'uk',
  'united-kingdom': 'united-kingdom',
  england: 'england',
  scotland: 'scotland',
  wales: 'wales',
  geopolitics: 'international-affairs',
  'international-affairs': 'international-affairs',
  'foreign-affairs': 'foreign-affairs',
  war: 'military-invasion',
  military: 'military-invasion',
  fed: 'fed',
  'federal-reserve': 'fed',
  macro: 'macro',
  economy: 'macro',
  economics: 'macro',
  gdp: 'gdp',
  inflation: 'inflation',
  recession: 'recession',
  'interest-rates': 'interest-rates',
  538: '538',

  // tech / ai
  tech: 'tech',
  technology: 'tech',
  ai: 'ai',
  'artificial-intelligence': 'ai',
  openai: 'openai',
  claude: 'claude',
  spacex: 'spacex',
  apple: 'apple',
  google: 'google',
  microsoft: 'microsoft',
  nvidia: 'nvidia',
  'elon-musk': 'elon-musk',

  // science / health / misc
  science: 'science',
  healthcare: 'healthcare',
  pandemics: 'pandemics',
  space: 'space',
  nasa: 'nasa',

  // entertainment / culture
  entertainment: 'entertainment',
  culture: 'pop-culture',
  'pop-culture': 'pop-culture',
  movies: 'movies',
  music: 'music',
  oscars: 'oscars',
  awards: 'awards',
  celebrities: 'celebrities',

  // cities (often tagged markets)
  london: 'london',
  liverpool: 'liverpool',
  manchester: 'manchester',
};

/** Unique canonical slugs agents can pass to discover_topic (alias targets + registry). */
export function listDiscoverTopicHints(): string[] {
  const slugs = new Set(Object.values(TOPIC_ALIASES));
  return [...slugs].sort();
}