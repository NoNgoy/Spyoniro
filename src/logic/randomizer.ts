/**
 * «Нормальный рандом» для игры «Шпион».
 *
 * Модуль чистый (без React / хранилища), чтобы его можно было полностью
 * покрыть юнит-тестами. Источник случайности передаётся снаружи (Rng):
 * в приложении — криптостойкий (expo-crypto / crypto.getRandomValues),
 * в тестах — детерминированный seeded-генератор.
 */
import type {
  Assignment,
  Card,
  ChaosEvent,
  DeckState,
  Decks,
  GameMode,
  Player,
  RoleKind,
  RoundPlan,
  SpyHistory,
  SpyStat,
} from './types';

/** Генератор равномерного числа в [0, 1) */
export type Rng = () => number;

// ---------------------------------------------------------------------------
// Генераторы
// ---------------------------------------------------------------------------

type GetRandomValues = (arr: Uint32Array) => Uint32Array;

/**
 * Криптостойкий RNG поверх getRandomValues. Значения запрашиваются пачками
 * по 64 штуки, чтобы не дёргать нативный модуль на каждый вызов.
 * Если getRandomValues недоступен — откатывается на Math.random.
 */
export function createSecureRng(getRandomValues?: GetRandomValues): Rng {
  const g: GetRandomValues | undefined =
    getRandomValues ??
    (typeof globalThis !== 'undefined' &&
    (globalThis as any).crypto &&
    typeof (globalThis as any).crypto.getRandomValues === 'function'
      ? (arr: Uint32Array) => (globalThis as any).crypto.getRandomValues(arr)
      : undefined);
  if (!g) return Math.random;
  const buf = new Uint32Array(64);
  let idx = buf.length;
  return () => {
    if (idx >= buf.length) {
      g(buf);
      idx = 0;
    }
    return buf[idx++] / 4294967296; // 2^32
  };
}

/** Детерминированный генератор (mulberry32) — для тестов и воспроизводимости */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** Перемешивание Фишера–Йетса (возвращает новый массив) */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * Взвешенная выборка k элементов без возвращения.
 * Если у оставшихся кандидатов суммарный вес 0 — выбор среди них равномерный.
 * Порядок результата — порядок выбора (т.е. тоже случайный).
 */
export function weightedSampleWithoutReplacement<T>(
  items: readonly T[],
  weights: readonly number[],
  k: number,
  rng: Rng,
): T[] {
  const pool = items.map((item, i) => ({ item, w: Math.max(0, weights[i] ?? 0) }));
  const out: T[] = [];
  const count = Math.min(k, pool.length);
  for (let n = 0; n < count; n++) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let index: number;
    if (total <= 0) {
      index = randomInt(rng, pool.length);
    } else {
      let r = rng() * total;
      index = pool.length - 1;
      for (let i = 0; i < pool.length; i++) {
        if (pool[i].w <= 0) continue;
        r -= pool[i].w;
        if (r < 0) {
          index = i;
          break;
        }
      }
      // защита от погрешности float: не выбрать элемент с нулевым весом
      while (pool[index].w <= 0) index--;
    }
    out.push(pool[index].item);
    pool.splice(index, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Выбор шпионов (Anti-Streak / Pity System)
// ---------------------------------------------------------------------------

export const SOFT_REPEAT_WEIGHT = 0.05;
/** Для 3 игроков полный запрет повтора слишком предсказуем — только сильно снижаем шанс */
export const SMALL_GROUP_REPEAT_WEIGHT = 0.15;
export const PITY_EXPONENT = 1.5;

/** Максимум шпионов, при котором мирных всегда строго больше */
export function maxSpies(playerCount: number): number {
  return Math.max(1, Math.floor((playerCount - 1) / 2));
}

/** Верхняя граница для режима «Случайное число шпионов» */
export function randomSpyRange(playerCount: number): [number, number] {
  const hi = playerCount >= 8 ? 3 : playerCount >= 5 ? 2 : 1;
  return [1, Math.min(hi, maxSpies(playerCount))];
}

export function resolveSpyCount(
  opts: { spyCount: number; randomSpyCount: boolean },
  playerCount: number,
  rng: Rng,
): number {
  if (opts.randomSpyCount) {
    const [lo, hi] = randomSpyRange(playerCount);
    return lo + randomInt(rng, hi - lo + 1);
  }
  return Math.max(1, Math.min(opts.spyCount, maxSpies(playerCount)));
}

export function spyWeight(stat: SpyStat, playerCount: number, hardAntiRepeat: boolean): number {
  const r = stat.roundsSinceLastSpy;
  if (r <= 0) {
    if (playerCount >= 4) return hardAntiRepeat ? 0 : SOFT_REPEAT_WEIGHT;
    return SMALL_GROUP_REPEAT_WEIGHT;
  }
  return Math.pow(r, PITY_EXPONENT);
}

/** Добавляет в историю недостающих игроков (новичкам — средний «стаж» остальных) */
export function ensureHistory(history: SpyHistory, players: readonly Player[]): SpyHistory {
  const known = players.filter((p) => history[p.id]);
  const avg = (key: 'roundsSinceLastSpy' | 'roundsSinceFirst') =>
    known.length
      ? Math.max(1, Math.round(known.reduce((s, p) => s + history[p.id][key], 0) / known.length))
      : 1;
  const out: SpyHistory = {};
  for (const p of players) {
    out[p.id] = history[p.id]
      ? { ...history[p.id] }
      : { roundsSinceLastSpy: avg('roundsSinceLastSpy'), timesSpy: 0, roundsSinceFirst: avg('roundsSinceFirst') };
  }
  return out;
}

export function pickSpies(
  players: readonly Player[],
  history: SpyHistory,
  count: number,
  hardAntiRepeat: boolean,
  rng: Rng,
): string[] {
  const h = ensureHistory(history, players);
  const weights = players.map((p) => spyWeight(h[p.id], players.length, hardAntiRepeat));
  return weightedSampleWithoutReplacement(players, weights, count, rng).map((p) => p.id);
}

/** Случайный первый игрок: не тот же, что в прошлом раунде, и с приоритетом «давно не начинавших» */
export function pickFirstPlayer(players: readonly Player[], history: SpyHistory, rng: Rng): string {
  const h = ensureHistory(history, players);
  const weights = players.map((p) => {
    const r = h[p.id].roundsSinceFirst;
    return r <= 0 ? 0 : Math.pow(r, PITY_EXPONENT);
  });
  return weightedSampleWithoutReplacement(players, weights, 1, rng)[0].id;
}

export function updateHistory(
  history: SpyHistory,
  players: readonly Player[],
  spyIds: readonly string[] | null,
  firstPlayerId: string,
): SpyHistory {
  const h = ensureHistory(history, players);
  const spies = new Set(spyIds ?? []);
  for (const p of players) {
    const s = h[p.id];
    if (spyIds) {
      if (spies.has(p.id)) {
        s.roundsSinceLastSpy = 0;
        s.timesSpy += 1;
      } else {
        s.roundsSinceLastSpy += 1;
      }
    }
    s.roundsSinceFirst = p.id === firstPlayerId ? 0 : s.roundsSinceFirst + 1;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Колода без повторов (Deck-based Draw)
// ---------------------------------------------------------------------------

/** Новая перетасованная колода; первая карта не совпадает с последней сыгранной */
export function newDeck(validIds: readonly string[], rng: Rng, lastDrawn?: string): DeckState {
  const order = shuffle(validIds, rng);
  if (lastDrawn && order.length > 1 && order[0] === lastDrawn) {
    const j = 1 + randomInt(rng, order.length - 1);
    order[0] = order[j];
    order[j] = lastDrawn;
  }
  return { order, pos: 0, lastDrawn };
}

/**
 * Приводит сохранённую колоду в соответствие с текущим набором карт пула:
 * удалённые/скрытые карты выбрасываются, новые — подмешиваются в
 * ещё не сыгранную часть колоды. Сброс (сыгранные карты) сохраняется.
 */
export function syncDeck(deck: DeckState | undefined, validIds: readonly string[], rng: Rng): DeckState {
  if (!deck) return newDeck(validIds, rng);
  const valid = new Set(validIds);
  const drawn = deck.order.slice(0, deck.pos).filter((id) => valid.has(id));
  let remaining = deck.order.slice(deck.pos).filter((id) => valid.has(id));
  const seen = new Set(deck.order);
  const fresh = validIds.filter((id) => !seen.has(id));
  if (fresh.length) remaining = shuffle([...remaining, ...fresh], rng);
  return { order: [...drawn, ...remaining], pos: drawn.length, lastDrawn: deck.lastDrawn };
}

export function deckRemaining(deck: DeckState): number {
  return deck.order.length - deck.pos;
}

/**
 * Тянет карту из объединённого пула (несколько категорий).
 * Категория выбирается с весом = числу оставшихся в её колоде карт, что
 * эквивалентно равномерному выбору из всех ещё не сыгранных карт.
 * Когда сыграны все карты всех выбранных пулов — колоды тасуются заново.
 */
export function drawCard(
  decks: Decks,
  cardIdsByPool: Record<string, readonly string[]>,
  rng: Rng,
): { cardId: string; decks: Decks } {
  const poolIds = Object.keys(cardIdsByPool).filter((id) => cardIdsByPool[id].length > 0);
  if (!poolIds.length) throw new Error('Нет доступных карточек в выбранных пулах');
  const next: Decks = { ...decks };
  for (const id of poolIds) next[id] = syncDeck(next[id], cardIdsByPool[id], rng);

  let weights = poolIds.map((id) => deckRemaining(next[id]));
  if (weights.every((w) => w === 0)) {
    for (const id of poolIds) next[id] = newDeck(cardIdsByPool[id], rng, next[id].lastDrawn);
    weights = poolIds.map((id) => deckRemaining(next[id]));
  }
  const poolId = weightedSampleWithoutReplacement(poolIds, weights, 1, rng)[0];
  const deck = next[poolId];
  const cardId = deck.order[deck.pos];
  next[poolId] = { order: deck.order, pos: deck.pos + 1, lastDrawn: cardId };
  return { cardId, decks: next };
}

// ---------------------------------------------------------------------------
// Близкая карточка для «Слепого шпиона»
// ---------------------------------------------------------------------------

export type SimilarTier = 'similar' | 'cluster' | 'pool';

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');

/** Кандидаты по уровням: similarIds (в обе стороны) → кластер → весь пул */
export function similarCandidates(civilian: Card, poolCards: readonly Card[]): Record<SimilarTier, Card[]> {
  const others = poolCards.filter((c) => c.id !== civilian.id && norm(c.name) !== norm(civilian.name));
  const explicit = new Set(civilian.similarIds);
  const similar = others.filter((c) => explicit.has(c.id) || c.similarIds.includes(civilian.id));
  const cluster = civilian.cluster ? others.filter((c) => c.cluster === civilian.cluster) : [];
  return { similar, cluster, pool: others };
}

export function pickBlindCard(
  civilian: Card,
  poolCards: readonly Card[],
  rng: Rng,
): { card: Card; tier: SimilarTier } | null {
  const tiers = similarCandidates(civilian, poolCards);
  for (const tier of ['similar', 'cluster', 'pool'] as SimilarTier[]) {
    const list = tiers[tier];
    if (list.length) return { card: list[randomInt(rng, list.length)], tier };
  }
  return null;
}

/** Набор разных карточек (для хаос-события «все шпионы» в слепом режиме) */
export function pickDistinctNearCards(civilian: Card, poolCards: readonly Card[], count: number, rng: Rng): Card[] {
  const tiers = similarCandidates(civilian, poolCards);
  const ordered = [
    ...shuffle(tiers.similar, rng),
    ...shuffle(tiers.cluster, rng),
    ...shuffle(tiers.pool, rng),
  ];
  const out: Card[] = [];
  const used = new Set<string>();
  for (const c of ordered) {
    if (used.has(c.id)) continue;
    used.add(c.id);
    out.push(c);
    if (out.length === count) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Планирование раунда целиком
// ---------------------------------------------------------------------------

export type PlanInput = {
  players: readonly Player[];
  mode: GameMode;
  spyCount: number;
  randomSpyCount: boolean;
  chaosMode: boolean;
  chaosChance: number;
  hardAntiRepeat: boolean;
  /** Видимые карточки выбранных пулов */
  cardsByPool: Record<string, readonly Card[]>;
  history: SpyHistory;
  decks: Decks;
  rng: Rng;
};

export type PlanOutput = {
  plan: RoundPlan;
  history: SpyHistory;
  decks: Decks;
};

export function planRound(input: PlanInput): PlanOutput {
  const { players, mode, rng } = input;
  if (players.length < 3) throw new Error('Нужно минимум 3 игрока');

  // 1. Хаос-событие
  let chaos: ChaosEvent = 'none';
  if (input.chaosMode && rng() < input.chaosChance) chaos = rng() < 0.5 ? 'allSpies' : 'noSpies';

  // 2. Карточка мирных из колоды
  const idsByPool: Record<string, string[]> = {};
  const byId = new Map<string, Card>();
  for (const [pid, cards] of Object.entries(input.cardsByPool)) {
    idsByPool[pid] = cards.map((c) => c.id);
    cards.forEach((c) => byId.set(c.id, c));
  }
  const draw = drawCard(input.decks, idsByPool, rng);
  const civilian = byId.get(draw.cardId)!;
  const poolCards = input.cardsByPool[civilian.poolId];

  // 3. Шпионы
  let spyIds: string[];
  if (chaos === 'allSpies') spyIds = shuffle(players.map((p) => p.id), rng);
  else if (chaos === 'noSpies') spyIds = [];
  else {
    const k = resolveSpyCount(input, players.length, rng);
    spyIds = pickSpies(players, input.history, k, input.hardAntiRepeat, rng);
  }

  // 4. Роли
  const roles = new Map<string, RoleKind>();
  spyIds.forEach((id, i) => {
    let role: RoleKind;
    if (mode === 'classic') role = 'classicSpy';
    else if (mode === 'blind') role = 'blindSpy';
    else if (chaos === 'allSpies') role = rng() < 0.5 ? 'classicSpy' : 'blindSpy';
    else if (spyIds.length >= 2) role = i === 0 ? 'classicSpy' : 'blindSpy';
    else role = rng() < 0.5 ? 'classicSpy' : 'blindSpy';
    roles.set(id, role);
  });

  // 5. Карточки шпионов
  const cardFor = new Map<string, string | null>();
  let blindCardId: string | null = null;
  if (chaos === 'allSpies') {
    const blindIds = spyIds.filter((id) => roles.get(id) === 'blindSpy');
    const near = pickDistinctNearCards(civilian, poolCards, blindIds.length, rng);
    blindIds.forEach((pid, i) => {
      if (near[i]) cardFor.set(pid, near[i].id);
      else roles.set(pid, 'classicSpy');
    });
  } else if (spyIds.some((id) => roles.get(id) === 'blindSpy')) {
    const picked = pickBlindCard(civilian, poolCards, rng);
    if (picked) blindCardId = picked.card.id;
    for (const id of spyIds) {
      if (roles.get(id) !== 'blindSpy') continue;
      if (blindCardId) cardFor.set(id, blindCardId);
      else roles.set(id, 'classicSpy'); // в пуле всего одна карточка — некого подставить
    }
  }

  const assignments: Assignment[] = players.map((p) => {
    const role = roles.get(p.id) ?? 'civilian';
    return {
      playerId: p.id,
      role,
      cardId: role === 'civilian' ? civilian.id : role === 'blindSpy' ? cardFor.get(p.id) ?? null : null,
    };
  });

  // 6. Первый игрок + обновление истории (хаос-раунды не влияют на баланс шпионов)
  const firstPlayerId = pickFirstPlayer(players, input.history, rng);
  const history = updateHistory(input.history, players, chaos === 'none' ? spyIds : null, firstPlayerId);

  return {
    plan: { civilianCardId: civilian.id, blindCardId, assignments, firstPlayerId, chaos, spyIds },
    history,
    decks: draw.decks,
  };
}
