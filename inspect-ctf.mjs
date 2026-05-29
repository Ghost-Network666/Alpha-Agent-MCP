import * as sdk from "@polymarket/client";

const pub = sdk.createPublicClient();
console.log("=== PUBLIC CLIENT METHODS (from installed beta SDK) ===");
const pubMethods = new Set();
let p = pub;
let depth = 0;
while (p && depth < 4) {
  for (const k of Object.getOwnPropertyNames(p)) {
    if (typeof pub[k] === 'function' && !k.startsWith('_')) pubMethods.add(k);
  }
  p = Object.getPrototypeOf(p);
  depth++;
}
console.log([...pubMethods].sort().join('\n'));

console.log("\n=== ALL EXPORTS CONTAINING CTF / POSITION / ONCHAIN / WALLET / GASLESS ===");
const all = Object.keys(sdk);
const related = all.filter(k => 
  /split|merge|redeem|ctf|transfer|approve|gasless|deploy|wallet|onchain|balance|allowance|transaction/i.test(k)
);
console.log(related.sort().join('\n'));

console.log("\n=== SECURE-SPECIFIC LIKELY METHODS (from earlier docs + bindings) ===");
const secureHints = all.filter(k => 
  /Secure|TradingApprovals|Position|Split|Merge|Redeem/i.test(k)
);
console.log(secureHints.slice(0, 40).join('\n'));
