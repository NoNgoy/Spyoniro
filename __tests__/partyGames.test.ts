import {
  aliasWinner,
  assignMafiaRoles,
  buildRoleList,
  createTiltDetector,
  MAFIA_ROLE_INFO,
  mafiaWinner,
  maxMafia,
  nightScript,
  resolveMafiaCount,
  scoreTurn,
  type MafiaSettings,
} from '../src/logic/partyGames';
import { createSeededRng } from '../src/logic/randomizer';
import type { SpyHistory } from '../src/logic/types';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Игрок ${i + 1}` }));

describe('Объясни слово', () => {
  test('очки за ход со штрафом и без', () => {
    const r = [
      { cardId: 'a', guessed: true },
      { cardId: 'b', guessed: false },
      { cardId: 'c', guessed: true },
    ];
    expect(scoreTurn(r, false)).toBe(2);
    expect(scoreTurn(r, true)).toBe(1);
  });

  test('победа только после полного круга и без ничьей', () => {
    expect(aliasWinner([50, 10], [3, 2], 50)).toBeNull(); // вторая команда ещё не ходила
    expect(aliasWinner([50, 52], [3, 3], 50)).toBe(1);
    expect(aliasWinner([50, 50], [3, 3], 50)).toBeNull(); // ничья — играем дальше
    expect(aliasWinner([40, 30], [3, 3], 50)).toBeNull();
  });
});

describe('Кто я? — наклон', () => {
  test('одно движение = одно действие, нужен возврат в нейтраль', () => {
    const d = createTiltDetector();
    const seq = [0, -0.5, -0.8, -0.9, -0.8, -0.2, 0.1, 0.8, 0.9, 0.1, -0.75];
    expect(seq.map(d).filter(Boolean)).toEqual(['guessed', 'skip', 'guessed']);
  });
});

describe('Мафия', () => {
  const base: MafiaSettings = {
    playerCount: 10,
    mafiaCount: 3,
    autoMafiaCount: true,
    don: true,
    doctor: true,
    sheriff: true,
    maniac: false,
  };

  test('состав ролей: мафии меньше остальных, минимум два мирных', () => {
    for (let n = 4; n <= 16; n++)
      for (const maniac of [false, true]) {
        const roles = buildRoleList({ ...base, playerCount: n, maniac, autoMafiaCount: false, mafiaCount: 99 });
        expect(roles).toHaveLength(n);
        const mafia = roles.filter((r) => MAFIA_ROLE_INFO[r].team === 'mafia').length;
        expect(mafia).toBe(maxMafia(n));
        expect(mafia).toBeLessThan(n - mafia);
        expect(roles.filter((r) => r === 'civilian').length).toBeGreaterThanOrEqual(2);
      }
    expect(resolveMafiaCount({ ...base, playerCount: 8 })).toBe(2);
    expect(buildRoleList({ ...base, playerCount: 4 })).toEqual(['mafia', 'sheriff', 'civilian', 'civilian']);
  });

  test('1000 партий: мафия не повторяется подряд и распределена равномерно', () => {
    const ps = players(8);
    const rng = createSeededRng(3);
    let h: SpyHistory = {};
    let prev: string[] = [];
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const out = assignMafiaRoles(ps, base, h, rng);
      h = out.history;
      const mafia = out.assignments.filter((a) => MAFIA_ROLE_INFO[a.role].team === 'mafia').map((a) => a.playerId);
      expect(mafia).toHaveLength(2);
      expect(out.assignments.map((a) => a.role).sort()).toEqual(buildRoleList({ ...base, playerCount: 8 }).sort());
      for (const id of mafia) expect(prev).not.toContain(id);
      mafia.forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
      prev = mafia;
    }
    for (const p of ps) expect(Math.abs(counts[p.id] - 250) / 250).toBeLessThan(0.12);
  });

  test('проверка победы', () => {
    expect(mafiaWinner(['civilian', 'doctor', 'sheriff'])).toBe('city');
    expect(mafiaWinner(['mafia', 'civilian'])).toBe('mafia');
    expect(mafiaWinner(['mafia', 'don', 'civilian', 'sheriff'])).toBe('mafia');
    expect(mafiaWinner(['mafia', 'civilian', 'sheriff'])).toBeNull();
    expect(mafiaWinner(['maniac', 'civilian'])).toBe('maniac');
    expect(mafiaWinner(['maniac', 'mafia', 'civilian'])).toBeNull();
  });

  test('сценарий ночи включает только роли из партии', () => {
    const s = nightScript(['mafia', 'civilian', 'doctor'], false).join('\n');
    expect(s).toContain('Доктор');
    expect(s).not.toContain('Шериф');
    expect(nightScript(['mafia', 'doctor'], true).join('\n')).not.toContain('Доктор');
  });
});
