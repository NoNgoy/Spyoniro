import {
  createSeededRng,
  createSecureRng,
  drawCard,
  maxSpies,
  pickBlindCard,
  pickSpies,
  planRound,
  shuffle,
  syncDeck,
  updateHistory,
  weightedSampleWithoutReplacement,
  type Rng,
} from '../src/logic/randomizer';
import type { Card, Decks, GameMode, Player, SpyHistory } from '../src/logic/types';
import { BUILTIN_POOLS } from '../src/data';

const ROUNDS = 1000;
const makePlayers = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Игрок ${i + 1}` }));
const poolById = (id: string) => BUILTIN_POOLS.find((p) => p.id === id)!;

function simulate(opts: {
  n: number;
  spyCount?: number;
  randomSpyCount?: boolean;
  mode?: GameMode;
  hard?: boolean;
  pools?: string[];
  rounds?: number;
  rng?: Rng;
  chaos?: boolean;
}) {
  const players = makePlayers(opts.n);
  const rng = opts.rng ?? createSeededRng(42 + opts.n);
  const cardsByPool: Record<string, Card[]> = {};
  for (const id of opts.pools ?? ['clash_royale']) cardsByPool[id] = poolById(id).cards;
  let history: SpyHistory = {};
  let decks: Decks = {};
  const plans = [];
  for (let r = 0; r < (opts.rounds ?? ROUNDS); r++) {
    const out = planRound({
      players,
      mode: opts.mode ?? 'classic',
      spyCount: opts.spyCount ?? 1,
      randomSpyCount: opts.randomSpyCount ?? false,
      chaosMode: opts.chaos ?? false,
      chaosChance: 0.1,
      hardAntiRepeat: opts.hard ?? true,
      cardsByPool,
      history,
      decks,
      rng,
    });
    history = out.history;
    decks = out.decks;
    plans.push(out.plan);
  }
  return { players, plans, history, cardsByPool };
}

describe('базовые примитивы', () => {
  test('Фишер–Йетс: перестановка без потерь и равномерно по позициям', () => {
    const rng = createSeededRng(1);
    const items = [0, 1, 2, 3, 4];
    const counts = items.map(() => items.map(() => 0));
    const T = 50000;
    for (let t = 0; t < T; t++) {
      const s = shuffle(items, rng);
      expect([...s].sort()).toEqual(items);
      s.forEach((v, pos) => counts[v][pos]++);
    }
    for (const row of counts) for (const c of row) expect(Math.abs(c - T / 5) / (T / 5)).toBeLessThan(0.05);
  });

  test('взвешенная выборка без возвращения: без дубликатов, нулевой вес не выпадает', () => {
    const rng = createSeededRng(2);
    for (let t = 0; t < 2000; t++) {
      const res = weightedSampleWithoutReplacement(['a', 'b', 'c', 'd'], [0, 1, 2, 3], 3, rng);
      expect(new Set(res).size).toBe(3);
      expect(res).not.toContain('a');
    }
  });

  test('secure RNG выдаёт числа в [0,1) и использует getRandomValues', () => {
    let calls = 0;
    const rng = createSecureRng((arr) => {
      calls++;
      for (let i = 0; i < arr.length; i++) arr[i] = (i * 2654435761) >>> 0;
      return arr;
    });
    for (let i = 0; i < 200; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(calls).toBeGreaterThan(0);
  });

  test('шпионов всегда меньше, чем мирных', () => {
    for (let n = 3; n <= 16; n++) {
      expect(maxSpies(n)).toBeGreaterThanOrEqual(1);
      expect(maxSpies(n)).toBeLessThan(n - maxSpies(n));
    }
  });
});

describe('Anti-Streak: выбор шпиона (1000 раундов)', () => {
  test.each([4, 5, 6, 8, 10, 16])('N=%i, 1 шпион: никто не шпионит два раунда подряд', (n) => {
    const { plans } = simulate({ n });
    for (let i = 1; i < plans.length; i++) {
      for (const id of plans[i].spyIds) expect(plans[i - 1].spyIds).not.toContain(id);
    }
  });

  test.each([5, 7, 10, 16])('N=%i, 2 шпиона: нет повторов подряд', (n) => {
    const { plans } = simulate({ n, spyCount: 2 });
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].spyIds).toHaveLength(2);
      for (const id of plans[i].spyIds) expect(plans[i - 1].spyIds).not.toContain(id);
    }
  });

  test('N=3: повтор подряд редкий (< 10% раундов), а не серия', () => {
    const { plans } = simulate({ n: 3 });
    let repeats = 0;
    let maxStreak = 1;
    let streak = 1;
    for (let i = 1; i < plans.length; i++) {
      if (plans[i].spyIds[0] === plans[i - 1].spyIds[0]) {
        repeats++;
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else streak = 1;
    }
    expect(repeats / plans.length).toBeLessThan(0.1);
    expect(maxStreak).toBeLessThanOrEqual(3);
  });

  test.each([
    [4, 1],
    [6, 1],
    [6, 2],
    [10, 3],
    [16, 1],
  ])('N=%i, шпионов=%i: равномерное распределение ролей (±12%%)', (n, k) => {
    const { plans, players } = simulate({ n, spyCount: k });
    const counts: Record<string, number> = {};
    for (const p of plans) for (const id of p.spyIds) counts[id] = (counts[id] ?? 0) + 1;
    const expected = (ROUNDS * k) / n;
    for (const p of players) expect(Math.abs((counts[p.id] ?? 0) - expected) / expected).toBeLessThan(0.12);
  });

  test('pity: самый «засидевшийся» игрок выпадает чаще остальных', () => {
    const players = makePlayers(5);
    const history: SpyHistory = {
      p1: { roundsSinceLastSpy: 12, timesSpy: 0, roundsSinceFirst: 1 },
      p2: { roundsSinceLastSpy: 1, timesSpy: 3, roundsSinceFirst: 1 },
      p3: { roundsSinceLastSpy: 2, timesSpy: 3, roundsSinceFirst: 1 },
      p4: { roundsSinceLastSpy: 3, timesSpy: 3, roundsSinceFirst: 1 },
      p5: { roundsSinceLastSpy: 0, timesSpy: 3, roundsSinceFirst: 1 },
    };
    const rng = createSeededRng(7);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) {
      const [id] = pickSpies(players, history, 1, true, rng);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts.p5 ?? 0).toBe(0);
    expect(counts.p1).toBeGreaterThan(counts.p4);
    expect(counts.p4).toBeGreaterThan(counts.p2);
  });

  test('мягкий анти-повтор: повтор возможен, но редок', () => {
    const { plans } = simulate({ n: 5, hard: false });
    let repeats = 0;
    for (let i = 1; i < plans.length; i++) if (plans[i].spyIds[0] === plans[i - 1].spyIds[0]) repeats++;
    expect(repeats / plans.length).toBeLessThan(0.03);
  });

  test('случайное число шпионов: в диапазоне 1–2 при 5+ игроках и встречаются оба', () => {
    const { plans } = simulate({ n: 6, randomSpyCount: true });
    const sizes = new Set(plans.map((p) => p.spyIds.length));
    expect([...sizes].sort()).toEqual([1, 2]);
  });

  test('первый игрок: не повторяется подряд и распределён равномерно', () => {
    const { plans, players } = simulate({ n: 6 });
    const counts: Record<string, number> = {};
    for (let i = 0; i < plans.length; i++) {
      counts[plans[i].firstPlayerId] = (counts[plans[i].firstPlayerId] ?? 0) + 1;
      if (i > 0) expect(plans[i].firstPlayerId).not.toBe(plans[i - 1].firstPlayerId);
    }
    for (const p of players) expect(Math.abs(counts[p.id] - ROUNDS / 6) / (ROUNDS / 6)).toBeLessThan(0.15);
  });
});

describe('Колода без повторов', () => {
  test.each(BUILTIN_POOLS.map((p) => [p.id, p.cards.length] as const))(
    'пул %s (%i карт): нет повторов до исчерпания колоды',
    (poolId) => {
      const { plans, cardsByPool } = simulate({ n: 5, pools: [poolId] });
      const size = cardsByPool[poolId].length;
      for (let start = 0; start + size <= plans.length; start += size) {
        const window = plans.slice(start, start + size).map((p) => p.civilianCardId);
        expect(new Set(window).size).toBe(size);
      }
      // и на стыке колод карта не повторяется подряд
      for (let i = 1; i < plans.length; i++) expect(plans[i].civilianCardId).not.toBe(plans[i - 1].civilianCardId);
    },
  );

  test('несколько пулов: общий замешанный пул без повторов до исчерпания всех карт', () => {
    const pools = ['clash_royale', 'bloggers', 'memes'];
    const { plans, cardsByPool } = simulate({ n: 6, pools });
    const total = pools.reduce((s, id) => s + cardsByPool[id].length, 0);
    for (let start = 0; start + total <= plans.length; start += total) {
      const window = plans.slice(start, start + total).map((p) => p.civilianCardId);
      expect(new Set(window).size).toBe(total);
    }
    const usedPools = new Set(plans.slice(0, 60).map((p) => p.civilianCardId.split('/')[0]));
    expect(usedPools.size).toBe(3);
  });

  test('syncDeck: новые карты подмешиваются, удалённые выбрасываются, сброс сохраняется', () => {
    const rng = createSeededRng(3);
    let decks: Decks = {};
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const drawn: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = drawCard(decks, { pool: ids }, rng);
      decks = r.decks;
      drawn.push(r.cardId);
    }
    const synced = syncDeck(decks.pool, ['a', 'b', 'c', 'd', 'e', 'f'].filter((x) => x !== drawn[0]), rng);
    expect(synced.order.slice(0, synced.pos)).toEqual(drawn.slice(1));
    expect(synced.order.slice(synced.pos).sort()).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'f'].filter((x) => !drawn.includes(x)).sort(),
    );
  });
});

describe('Слепой шпион: подбор близкой карточки', () => {
  test.each(BUILTIN_POOLS.map((p) => [p.id] as const))('пул %s: 1000 раундов — карточка шпиона ≠ карточке мирных', (poolId) => {
    const { plans } = simulate({ n: 6, mode: 'blind', pools: [poolId] });
    for (const p of plans) {
      expect(p.blindCardId).toBeTruthy();
      expect(p.blindCardId).not.toBe(p.civilianCardId);
      const spy = p.assignments.find((a) => a.role === 'blindSpy')!;
      expect(spy.cardId).toBe(p.blindCardId);
      const civ = p.assignments.filter((a) => a.role === 'civilian');
      expect(civ.every((a) => a.cardId === p.civilianCardId)).toBe(true);
    }
  });

  test('приоритет: similarIds → кластер → весь пул', () => {
    const rng = createSeededRng(11);
    const cr = poolById('clash_royale').cards;
    const mega = cr.find((c) => c.name === 'Мегарыцарь')!;
    for (let i = 0; i < 200; i++) {
      const r = pickBlindCard(mega, cr, rng)!;
      expect(r.tier).toBe('similar');
      expect(r.card.name).not.toBe('Мегарыцарь');
    }
    // без similarIds — из того же кластера
    const noSim = { ...mega, similarIds: [] };
    const crNoBack = cr.map((c) => ({ ...c, similarIds: c.similarIds.filter((id) => id !== mega.id) }));
    for (let i = 0; i < 200; i++) {
      const r = pickBlindCard(noSim, crNoBack, rng)!;
      expect(r.tier).toBe('cluster');
      expect(r.card.cluster).toBe(mega.cluster);
      expect(r.card.id).not.toBe(mega.id);
    }
    // ни похожих, ни кластера — любая другая карточка пула
    const lone = { ...noSim, cluster: undefined };
    const r = pickBlindCard(lone, crNoBack, rng)!;
    expect(r.tier).toBe('pool');
    expect(r.card.id).not.toBe(mega.id);
  });

  test('примеры из ТЗ: Мегарыцарь→П.Е.К.К.А., Бустер→Эвелон-подобные, АК-47→M4A1', () => {
    const rng = createSeededRng(5);
    const pick = (pool: string, name: string) => {
      const cards = poolById(pool).cards;
      return pickBlindCard(cards.find((c) => c.name === name)!, cards, rng)!.card.name;
    };
    expect(pick('clash_royale', 'Мегарыцарь')).toBe('П.Е.К.К.А.');
    expect(['Эвелон', 'Мокривский', 'Строго']).toContain(pick('bloggers', 'Бустер'));
    expect(['M4A1']).toContain(pick('games', 'АК-47'));
  });

  test('пул из одной карточки: слепой шпион становится классическим, а не получает то же слово', () => {
    const one: Card = { id: 'x/Одна', name: 'Одна', poolId: 'x', similarIds: [], tags: [] };
    const out = planRound({
      players: makePlayers(4),
      mode: 'blind',
      spyCount: 1,
      randomSpyCount: false,
      chaosMode: false,
      chaosChance: 0,
      hardAntiRepeat: true,
      cardsByPool: { x: [one] },
      history: {},
      decks: {},
      rng: createSeededRng(1),
    });
    const spy = out.plan.assignments.find((a) => a.playerId === out.plan.spyIds[0])!;
    expect(spy.role).toBe('classicSpy');
    expect(spy.cardId).toBeNull();
  });

  test('смешанный режим с 2 шпионами: один классический, один слепой', () => {
    const { plans } = simulate({ n: 7, spyCount: 2, mode: 'mixed', rounds: 300 });
    for (const p of plans) {
      const roles = p.assignments.filter((a) => a.role !== 'civilian').map((a) => a.role).sort();
      expect(roles).toEqual(['blindSpy', 'classicSpy']);
    }
  });
});

describe('Хаос-режим', () => {
  test('бывают раунды «все шпионы» и «нет шпионов», остальные — обычные', () => {
    const { plans } = simulate({ n: 6, chaos: true, mode: 'blind' });
    const all = plans.filter((p) => p.chaos === 'allSpies');
    const none = plans.filter((p) => p.chaos === 'noSpies');
    expect(all.length).toBeGreaterThan(10);
    expect(none.length).toBeGreaterThan(10);
    for (const p of all) {
      expect(p.assignments.every((a) => a.role !== 'civilian')).toBe(true);
      const cards = p.assignments.map((a) => a.cardId).filter(Boolean);
      expect(new Set(cards).size).toBe(cards.length); // у всех разные слова
      expect(cards).not.toContain(p.civilianCardId);
    }
    for (const p of none) expect(p.assignments.every((a) => a.role === 'civilian')).toBe(true);
  });

  test('хаос-раунды не ломают анти-повтор', () => {
    const players = makePlayers(5);
    let h: SpyHistory = {};
    h = updateHistory(h, players, ['p1'], 'p2');
    h = updateHistory(h, players, null, 'p3'); // хаос-раунд
    expect(h.p1.roundsSinceLastSpy).toBe(0);
  });
});
