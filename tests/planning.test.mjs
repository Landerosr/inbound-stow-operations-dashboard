import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastProduction, calculateScenario } from '../lib/planning.ts';
const sample = { incomingTrailers: 15, unitsPerTrailer: 12200, volumeGoal: 183000, startingBacklogUnits: 183000, headcount: 80, shiftHours: 10, stowRate: 260 };
test('ten-hour shift reaches 176800 and remains flat through hour 24', () => {
 const rows = forecastProduction(sample);
 assert.equal(rows[0].production, 0);
 assert.equal(rows.find(r => r.hour === 10).production, 176800);
 assert.equal(rows.at(-1).production, calculateScenario(sample).processedUnits);
 assert.equal(rows.at(-1).hour, 24);
});
test('extra staffing caps production at goal and preserves reserve', () => {
 const rows = forecastProduction({...sample, headcount: 100});
 assert.equal(rows.at(-1).production, 183000);
 assert(rows.every(r => r.production <= 183000));
});
test('zero capacity and insufficient inbound never release protected reserve', () => {
 for (const change of [{headcount:0},{shiftHours:0},{stowRate:0},{incomingTrailers:0}])
 assert(forecastProduction({...sample,...change}).every(r => r.production === 0));
});
test('fractional shift ends at its exact hour; long shifts stop at 24-hour window', () => {
 assert.equal(forecastProduction({...sample,shiftHours:0.5}).find(r=>r.hour===0.5).production,8840);
 assert.equal(forecastProduction({...sample,shiftHours:30,volumeGoal:1e6,startingBacklogUnits:2e6}).at(-1).production,424320);
});
