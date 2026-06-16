const fs = require('fs');
const stationDataContent = fs.readFileSync('c:/Development/OysterSavings/src/lib/data/stationData.ts', 'utf-8');
const entryRegex = /'([^']+)':\s*\{([\s\S]*?)\},/g;
let match;
const keys = [];
while ((match = entryRegex.exec(stationDataContent)) !== null) {
  keys.push(match[1]);
}
console.log(`Loaded ${keys.length} stations.`);
console.log("Keys containing 'elephant':", keys.filter(k => k.includes('elephant')));
console.log("Keys containing 'castle':", keys.filter(k => k.includes('castle')));
console.log("Keys containing 'barnes':", keys.filter(k => k.includes('barnes')));
