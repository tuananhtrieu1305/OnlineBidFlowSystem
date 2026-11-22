import type { Product } from '../products/productApi';
import type { LiveMissionTemplate, NewLiveLot } from './liveState';
export function toLiveLot(product: Product): NewLiveLot {
  return { id: 'product-' + product.id, productId: product.id, productVersion: product.version,
    name: product.name, description: product.description ?? '', imageUrl: product.imageUrl,
    startingPrice: product.estimatedPrice && BigInt(product.estimatedPrice) > 0n ? product.estimatedPrice : '100' };
}
export function missionFloor(mission: LiveMissionTemplate, lots: NewLiveLot[]): string | null {
  let minimum: bigint | null = null;
  for (const a of lots.filter(l => mission.groupA.includes(l.productId))) {
    for (const b of lots.filter(l => mission.groupB.includes(l.productId))) {
      if (a.productId === b.productId || !/^[1-9][0-9]*$/.test(a.startingPrice) || !/^[1-9][0-9]*$/.test(b.startingPrice)) continue;
      const total = BigInt(a.startingPrice) + BigInt(b.startingPrice);
      if (minimum === null || total < minimum) minimum = total;
    }
  }
  return minimum?.toString() ?? null;
}
export function demoMissions(lots: NewLiveLot[]): LiveMissionTemplate[] {
  return lots.slice(0, 3).flatMap((a, index) => {
    const b = lots[(index + 1) % lots.length];
    return b && a.productId !== b.productId ? [{ title: `Mua ${a.name} và ${b.name}`.slice(0, 200), groupA: [a.productId], groupB: [b.productId] }] : [];
  });
}
