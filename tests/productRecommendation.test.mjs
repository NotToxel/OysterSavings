import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendProduct } from '../src/lib/engine/productRecommendation.ts';
import { parseCSV } from '../src/lib/engine/csvParser.ts';

function comparison(overrides = {}) {
  const data = { zoneRange: 'Z1-3', travelcardEligible: true };
  for (const span of ['weekly', 'monthly', 'annual']) {
    Object.assign(data, {
      [`${span}Payg`]: 100, [`${span}PaygFareType`]: 60,
      [`${span}PaygRailcard`]: 80, [`${span}Travelcard`]: 110,
      [`${span}StudentTravelcard`]: 70, [`${span}BusPass`]: 130,
      [`${span}StudentBusPass`]: 90,
    });
  }
  return { ...data, ...overrides };
}

test('adult recommendations exclude unselected concessions for every period', () => {
  for (const span of ['weekly', 'monthly', 'annual']) {
    assert.equal(recommendProduct(comparison(), span, 'none').name, 'PAYG');
  }
});

test('recommendations use the selected discount and preserve free concession fares', () => {
  assert.equal(recommendProduct(comparison(), 'monthly', 'railcard').cost, 80);
  assert.equal(recommendProduct(comparison(), 'monthly', 'student').name, 'Student Travelcard');
  assert.equal(recommendProduct(comparison({ monthlyPaygFareType: 0 }), 'monthly', 'zip_11_15').cost, 0);
});

test('contactless-only history cannot recommend a Travelcard', () => {
  const data = comparison({ travelcardEligible: false, monthlyTravelcard: 1, monthlyStudentTravelcard: 1 });
  assert.equal(recommendProduct(data, 'monthly', 'student').name, 'Student Bus Pass');
});

test('display-only fields cannot change the recommended product or saving', () => {
  const before = recommendProduct(comparison(), 'monthly', 'railcard');
  const after = recommendProduct({ ...comparison(), visibleProducts: { paygRailcard: false } }, 'monthly', 'railcard');
  assert.deepEqual(after, before);
  assert.equal(before.saving, 20);
});

test('CSV with unrelated headers is rejected with a recovery message', () => {
  const result = parseCSV('name,amount\nSomeone,10');
  assert.equal(result.journeys.length, 0);
  assert.match(result.errors[0], /missing TfL columns/);
});

test('CSV retains valid journeys and reports invalid rows', () => {
  const result = parseCSV('Date,Start Time,Journey/Action,Charge\n17-Oct-2026,08:00,Bus journey route 1,1.75\ninvalid,09:00,Bus journey route 2,1.75');
  assert.equal(result.journeys.length, 1);
  assert.equal(result.errors.length, 1);
});
