import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectDirectionalFare } from '../src/lib/engine/directionalFare.ts';
import { generatePlannedJourneys } from '../src/lib/engine/recurrenceEngine.ts';

test('return route selection uses its own prices and corresponding adult prices', () => {
  const fare = { isFromApi: true, peak: 7, offPeak: 5, basePeak: 9, baseOffPeak: 7,
    options: [{ routeDescription: 'Default Route', peak: 7, offPeak: 5 }, { routeDescription: 'Via interchange', peak: 6, offPeak: 4 }],
    baseOptions: [{ routeDescription: 'Via interchange', peak: 8, offPeak: 6 }] };
  assert.deepEqual(selectDirectionalFare(fare, 'Via interchange'), {
    peak: 6, offPeak: 4, basePeak: 8, baseOffPeak: 6, routeDescription: 'Via interchange', isFromApi: true,
  });
  assert.equal(selectDirectionalFare(fare, 'Outbound-only route').peak, 7);
  assert.equal(selectDirectionalFare(fare, '', true).peak, 6);
});

const routine = {
  id: 'directional-regression', name: 'Barnes commute', originZone: 3, destinationZone: 1,
  originStationName: 'Barnes', destinationStationName: 'London Waterloo', mode: 'national_rail',
  timePeriod: '06:30-09:30', returnTimePeriod: '16:00-19:00', isReturn: true,
  daysOfWeek: [1], intervalType: 'weeks', intervalValue: 1,
  startDate: new Date(2026, 9, 19), endDate: new Date(2026, 9, 19), isAdvancedMode: true,
  exactFarePeak: 4.6, exactFareOffPeak: 3.7, exactBaseFarePeak: 4.6, exactBaseFareOffPeak: 3.7,
  returnExactFarePeak: 5.2, returnExactFareOffPeak: 4.1, returnExactBaseFarePeak: 5.2, returnExactBaseFareOffPeak: 4.1,
  routeDescription: 'Outbound route', returnRouteDescription: 'Reverse route',
};

test('generated return journeys reverse zones, names and time and retain reverse quote', () => {
  const [outbound, inbound] = generatePlannedJourneys([routine]);
  assert.equal(outbound.exactFarePeak, 4.6);
  assert.equal(inbound.exactFarePeak, 5.2);
  assert.equal(inbound.exactFareOffPeak, 4.1);
  assert.equal(inbound.exactBaseFarePeak, 5.2);
  assert.equal(inbound.originZone, 1);
  assert.equal(inbound.destinationZone, 3);
  assert.equal(inbound.originStationName, 'London Waterloo');
  assert.equal(inbound.timePeriod, '16:00-19:00');
  assert.equal(inbound.routeDescription, 'Reverse route');
});

test('legacy routines do not invent a reverse quote from outbound prices', () => {
  const [, inbound] = generatePlannedJourneys([{ ...routine, returnExactFarePeak: undefined, returnExactFareOffPeak: undefined }]);
  assert.equal(inbound.exactFarePeak, undefined);
  assert.equal(inbound.exactFareOffPeak, undefined);
});
