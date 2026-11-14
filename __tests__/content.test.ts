import { BUILTIN_POOLS, RAW_POOLS } from '../src/data';
import {
  base64DecodeUtf8,
  base64EncodeUtf8,
  customToPool,
  exportPoolCode,
  exportPoolJson,
  importPool,
  mergeCards,
  parseBulkInput,
  type CustomPool,
} from '../src/logic/customPools';
import { pickBlindCard, createSeededRng } from '../src/logic/randomizer';

const MIN: Record<string, number> = { clash_royale: 60, bloggers: 50 };

describe('встроенные пулы', () => {
  test.each(BUILTIN_POOLS.map((p) => [p.id, p] as const))('%s: размер, уникальность, ссылки', (id, pool) => {
    expect(pool.cards.length).toBeGreaterThanOrEqual(MIN[id] ?? 40);
    const names = pool.cards.map((c) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    const ids = new Set(pool.cards.map((c) => c.id));
    for (const c of pool.cards) {
      for (const s of c.similarIds) {
        expect(ids.has(s)).toBe(true);
        expect(s).not.toBe(c.id);
      }
      expect(c.cluster).toBeTruthy();
    }
  });

  test('у каждой карточки есть близкий аналог (similar или кластер)', () => {
    const rng = createSeededRng(9);
    for (const pool of BUILTIN_POOLS)
      for (const c of pool.cards) {
        const r = pickBlindCard(c, pool.cards, rng);
        expect(r && r.tier !== 'pool').toBeTruthy();
      }
  });

  test('id пулов уникальны', () => {
    expect(new Set(RAW_POOLS.map((p) => p.id)).size).toBe(RAW_POOLS.length);
  });
});

describe('свои пулы', () => {
  test('быстрый ввод: слова, пары и кластеры', () => {
    const cards = parseBulkInput('Пицца\n\n  Суши  \nКола :: Пепси\nБургер | фастфуд\nпицца\n');
    expect(cards.map((c) => c.name)).toEqual(['Пицца', 'Суши', 'Кола', 'Пепси', 'Бургер']);
    expect(cards.find((c) => c.name === 'Кола')!.similar).toEqual(['Пепси']);
    expect(cards.find((c) => c.name === 'Бургер')!.cluster).toBe('фастфуд');
    const pool = customToPool({ id: 'c1', name: 'Еда', icon: '🍕', color: '#ff0000', cards });
    const cola = pool.cards.find((c) => c.name === 'Кола')!;
    expect(cola.similarIds).toEqual(['c1/Пепси']);
    const rng = createSeededRng(1);
    for (let i = 0; i < 50; i++) expect(pickBlindCard(cola, pool.cards, rng)!.card.name).toBe('Пепси');
  });

  test('слияние не дублирует карточки', () => {
    const merged = mergeCards([{ name: 'Кот', similar: [] }], [{ name: 'кот', similar: ['Пёс'] }, { name: 'Пёс', similar: [] }]);
    expect(merged).toHaveLength(2);
    expect(merged[0].similar).toEqual(['Пёс']);
  });

  test('base64 UTF-8 туда-обратно (кириллица, эмодзи)', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'Привет, мир! 👑🐸', 'П.Е.К.К.А. ё Ё']) expect(base64DecodeUtf8(base64EncodeUtf8(s))).toBe(s);
  });

  test('экспорт → импорт (код и JSON)', () => {
    const cp: CustomPool = {
      id: 'c2',
      name: 'Друзья',
      icon: '🧑‍🤝‍🧑',
      color: '#22c55e',
      cards: parseBulkInput('Вася :: Петя\nМаша | девочки\nКатя'),
    };
    for (const code of [exportPoolCode(cp), exportPoolJson(cp)]) {
      const imp = importPool(code);
      expect(imp.name).toBe('Друзья');
      expect(imp.icon).toBe(cp.icon);
      expect(imp.cards).toEqual(cp.cards);
    }
    const builtIn = importPool(exportPoolCode(BUILTIN_POOLS[0]));
    expect(builtIn.cards.length).toBe(BUILTIN_POOLS[0].cards.length);
    expect(() => importPool('мусор')).toThrow();
  });
});
