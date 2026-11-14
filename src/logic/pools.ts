import type { Card, Pool } from './types';

/** Формат JSON-файлов встроенных пулов (src/data/pools/*.json) */
export type RawCard = string | { name: string; similar?: string[]; tags?: string[] };
export type RawCluster = { id: string; label: string; tags?: string[]; cards: RawCard[] };
export type RawPool = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  clusters: RawCluster[];
};

export const cardId = (poolId: string, name: string) => `${poolId}/${name.trim()}`;

export function normalizePool(raw: RawPool, builtIn = true): Pool {
  const clusterLabels: Record<string, string> = {};
  const cards: Card[] = [];
  for (const cl of raw.clusters) {
    clusterLabels[cl.id] = cl.label;
    for (const rc of cl.cards) {
      const obj = typeof rc === 'string' ? { name: rc } : rc;
      cards.push({
        id: cardId(raw.id, obj.name),
        name: obj.name.trim(),
        poolId: raw.id,
        cluster: cl.id,
        similarIds: (obj.similar ?? []).map((n) => cardId(raw.id, n)),
        tags: [...(cl.tags ?? []), ...(obj.tags ?? [])],
      });
    }
  }
  return {
    id: raw.id,
    name: raw.name,
    icon: raw.icon,
    color: raw.color,
    description: raw.description,
    builtIn,
    clusterLabels,
    cards,
  };
}
