cat > src/strategies/index.ts << 'EOL'
export { SimpleMarketMaker } from './marketMaker.js';
export { executeSimpleArbitrage, scanAndReportArbitrage } from './arbitrage.js';
