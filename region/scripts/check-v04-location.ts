import assert from 'node:assert/strict';
import {
  crewPositionFor, knownCrewL3Zone, validCrewPosition,
  type CrewLocationState, type CrewMission, type CrewPosition,
} from '../packages/gameplay/src/region/location';

const legacy: CrewLocationState = {
  day: 4,
  homeZoneId: 'L3-HQ',
  survivors: [
    { id: 'present', alive: true },
    { id: 'away', alive: true, awayUntil: 7 },
    { id: 'dead', alive: false },
    { id: 'left', alive: true, left: true },
  ],
};

assert.deepEqual(crewPositionFor(legacy, 'present'), { kind: 'zone', zoneId: 'L3-HQ' });
assert.deepEqual(crewPositionFor(legacy, 'away'), { kind: 'away-unknown', expectedReturnDay: 7 });
assert.equal(knownCrewL3Zone(crewPositionFor(legacy, 'away')!), undefined);
assert.equal(crewPositionFor(legacy, 'dead'), undefined);
assert.equal(crewPositionFor(legacy, 'left'), undefined);
assert.equal(crewPositionFor(legacy, 'missing'), undefined);

const positions: CrewPosition[] = [
  { kind: 'zone', zoneId: 'L3-1' },
  { kind: 'transit', fromZoneId: 'L3-1', toZoneId: 'L3-3', routeZoneIds: ['L3-1', 'L3-2', 'L3-3'], atIndex: 1, departedDay: 4, estimatedArrivalDay: 6 },
  { kind: 'area-duty', areaLevel: 2, areaZoneId: 'L2-1', duty: 'guard' },
  { kind: 'area-duty', areaLevel: 3, areaZoneId: 'L3-5', duty: 'patrol' },
  { kind: 'away-unknown', expectedReturnDay: 8 },
];
for (const position of positions) {
  assert.equal(validCrewPosition(position), true);
  assert.deepEqual(JSON.parse(JSON.stringify(position)), position);
}
assert.equal(knownCrewL3Zone(positions[1]), 'L3-2');
assert.equal(knownCrewL3Zone(positions[2]), undefined);
assert.equal(knownCrewL3Zone(positions[3]), undefined);
assert.equal(validCrewPosition({ kind: 'transit', fromZoneId: 'L3-1', toZoneId: 'L3-1', routeZoneIds: ['L3-1'], atIndex: 2, departedDay: 1, estimatedArrivalDay: 2 }), false);

const mission: CrewMission = {
  id: 'mission-04', orderId: 'order-04', action: 'scout', survivorIds: ['present'],
  originZoneId: 'L3-HQ', targetZoneId: 'L3-2', issuedDay: 4, status: 'outbound', expectedReturnDay: 6,
};
assert.deepEqual(JSON.parse(JSON.stringify(mission)), mission);
assert.deepEqual(crewPositionFor({ ...legacy, crewPositions: { present: positions[1] } }, 'present'), positions[1]);
assert.equal(crewPositionFor({ ...legacy, crewPositions: { present: positions[1] } }, 'away'), undefined);
assert.equal(crewPositionFor({ ...legacy, crewPositions: {} }, 'present'), undefined);
assert.equal(validCrewPosition(JSON.parse('{"kind":"area-duty","areaZoneId":"L2-1","areaLevel":1,"duty":"guard"}') as CrewPosition), false);
assert.equal(validCrewPosition(JSON.parse('{"kind":"area-duty","areaZoneId":"L2-1","areaLevel":2,"duty":"attack"}') as CrewPosition), false);

process.stdout.write('v0.4 crew location contract: OK\n');
