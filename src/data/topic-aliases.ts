/**
 * UK + US only: agent topic → Gamma tagSlug. Registry holds tagIds for these slugs only.
 * Other regions/topics: use search({ q }) or exact slug if you know it (sdk_fetchTag).
 */

/** Broad categories (category= on list_* tools). */
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
  US: 'politics',
};

/** Curated aliases — UK + US markets only. */
export const TOPIC_ALIASES: Record<string, string> = {
  ...CATEGORY_TAG_SLUG,

  // UK
  uk: 'uk',
  'united-kingdom': 'united-kingdom',
  'uk-politics': 'uk',
  england: 'england',
  scotland: 'scotland',
  wales: 'wales',
  london: 'london',
  liverpool: 'liverpool',
  manchester: 'manchester',
  'premier-league': 'premier-league',
  'champions-league': 'champions-league',
  'europa-league': 'europa-league',
  cricket: 'cricket',

  // UK / US weather & temp markets
  weather: 'weather',
  climate: 'climate',
  temperature: 'temperature',
  'daily-temperature': 'daily-temperature',
  'highest-temperature': 'highest-temperature',
  'lowest-temperature': 'lowest-temperature',
  recurring: 'recurring',

  // US politics & elections
  politics: 'politics',
  political: 'politics',
  'us-politics': 'politics',
  us: 'politics',
  usa: 'politics',
  election: 'election',
  elections: 'election',
  'us-election': 'election',
  trump: 'trump',
  biden: 'biden',
  congress: 'congress',
  government: 'federal-government',
  'federal-government': 'federal-government',
  senate: 'sentate',
  'house-races': 'house-races',
  538: '538',
  'legal-cases': 'legal-cases',
  law: 'legal-cases',
  legal: 'legal-cases',

  // US macro
  macro: 'macro',
  'macro-graph': 'macro-graph',
  'macro-single': 'macro-single',
  'macro-indicators': 'macro-indicators',
  economy: 'macro-single',
  economics: 'macro-single',
  fed: 'fed',
  'federal-reserve': 'fed',
  gdp: 'gdp',
  inflation: 'inflation',
  recession: 'recession',
  'interest-rates': 'interest-rates',

  // US sports
  sports: 'sports',
  sport: 'sports',
  nfl: 'nfl',
  nba: 'nba',
  mlb: 'mlb',
  nhl: 'nhl',
  football: 'nfl',
  soccer: 'soccer',
  ufc: 'ufc',
  'college-football': 'college-football',
  'world-cup': 'world-cup',
  boxing: 'boxing',
  golf: 'golf',
  f1: 'f1',

  // US geo (temp / local event tags)
  'los-angeles': 'los-angeles',
  la: 'los-angeles',

  // Crypto (US-heavy volume; global tag)
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
  nft: 'nft',
  memecoins: 'memecoins',
  memecoin: 'memecoins',

  // Tech / AI (US-centric listings)
  tech: 'tech',
  technology: 'tech',
  ai: 'ai',
  'artificial-intelligence': 'ai',
  openai: 'openai',
  claude: 'claude',

  // Light culture (US/UK media)
  entertainment: 'entertainment',
  'pop-culture': 'pop-culture',
  culture: 'pop-culture',
  science: 'science',
};

/** Slugs with static tagIds in gamma-tag-registry (UK + US curated). */
export function listCuratedRegistrySlugs(): string[] {
  return [...new Set(Object.values(TOPIC_ALIASES))].sort();
}

/** Hints shown to agents — same as curated slugs. */
export function listDiscoverTopicHints(): string[] {
  return listCuratedRegistrySlugs();
}