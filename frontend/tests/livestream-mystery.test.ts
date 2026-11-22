import { describe, expect, it } from 'vitest';
import { toLiveLot, demoMissions, missionFloor } from '../src/features/livestream/mysterySetup';
import type { Product } from '../src/features/products/productApi';
const products: Product[] = [1,2,3,4].map(id => ({ id: String(id), name: 'Real ' + id, description: 'Stock', quantity: 1, estimatedPrice: String(id * 100), imageUrl: null, editable: true, editBlockedReason: null, version: 'v' + id }));
describe('mystery demo configuration', () => {
  it('uses actual names, prices and product versions and excludes the secret from missions', () => {
    const lots = products.map(toLiveLot);
    const missions = demoMissions(lots.slice(0, -1));
    expect(lots[0]).toMatchObject({ name: 'Real 1', startingPrice: '100', productVersion: 'v1' });
    expect(missions).toHaveLength(3);
    expect(missions.every(m => ![...m.groupA, ...m.groupB].includes('4'))).toBe(true);
    expect(missions.every(m => missionFloor(m, lots) !== null)).toBe(true);
  });
  it('requires two different products even when groups overlap', () => {
    const lots = products.map(toLiveLot);
    expect(missionFloor({ title: 'Pair', groupA: ['1'], groupB: ['1'] }, lots)).toBeNull();
    expect(missionFloor({ title: 'Pair', groupA: ['1','2'], groupB: ['1','2'] }, lots)).toBe('300');
    expect(missionFloor({ title: 'Pair', groupA: ['1'], groupB: ['99'] }, lots)).toBeNull();
  });
});
