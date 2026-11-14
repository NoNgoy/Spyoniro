/**
 * Логика дополнительных игр сборника: «Объясни слово», «Кто я?», «Мафия».
 * Чистые функции без React — покрыты тестами в __tests__/partyGames.test.ts.
 */
import { pickSpies, shuffle, updateHistory, type Rng } from './randomizer';
import type { Player, SpyHistory } from './types';

// ---------------------------------------------------------------------------
// «Объясни слово» (командная игра на время)
// ---------------------------------------------------------------------------

export type WordResult = { cardId: string; guessed: boolean };

export type AliasSettings = {
  teamCount: number;
  teamNames: string[];
  roundSeconds: number;
  targetScore: number;
  skipPenalty: boolean;
  selectedPoolIds: string[];
};

export function scoreTurn(results: readonly WordResult[], skipPenalty: boolean): number {
  let s = 0;
  for (const r of results) s += r.guessed ? 1 : skipPenalty ? -1 : 0;
  return s;
}

/**
 * Победитель определяется только после полного круга (у всех команд поровну ходов),
 * когда лидер набрал целевой счёт и обгоняет остальных. При ничьей играем дальше.
 */
export function aliasWinner(scores: readonly number[], turns: readonly number[], target: number): number | null {
  if (!scores.length || turns.some((t) => t !== turns[0]) || turns[0] === 0) return null;
  const max = Math.max(...scores);
  if (max < target) return null;
  const leaders = scores.map((s, i) => (s === max ? i : -1)).filter((i) => i >= 0);
  return leaders.length === 1 ? leaders[0] : null;
}

// ---------------------------------------------------------------------------
// «Кто я?» — распознавание наклона телефона на лбу
// ---------------------------------------------------------------------------

export type TiltAction = 'guessed' | 'skip' | null;

/**
 * Телефон держат вертикально экраном от себя. Наклон головы вниз (экран смотрит в пол)
 * даёт z ≈ −1 → «угадал», наклон вверх (экран в потолок) z ≈ +1 → «пропуск».
 * После действия нужно вернуться в нейтральное положение (|z| < reset), иначе
 * одно движение засчитается много раз.
 */
export function createTiltDetector(threshold = 0.7, reset = 0.35) {
  let armed = true;
  return (z: number): TiltAction => {
    if (!armed) {
      if (Math.abs(z) < reset) armed = true;
      return null;
    }
    if (z <= -threshold) {
      armed = false;
      return 'guessed';
    }
    if (z >= threshold) {
      armed = false;
      return 'skip';
    }
    return null;
  };
}

export type HeadsSettings = {
  roundSeconds: number;
  useTilt: boolean;
  selectedPoolIds: string[];
};

// ---------------------------------------------------------------------------
// «Мафия» — раздача ролей и проверка победы
// ---------------------------------------------------------------------------

export type MafiaRole = 'mafia' | 'don' | 'doctor' | 'sheriff' | 'maniac' | 'civilian';

export const MAFIA_ROLE_INFO: Record<MafiaRole, { title: string; emoji: string; team: 'mafia' | 'city' | 'solo'; hint: string }> = {
  mafia: { title: 'Мафия', emoji: '🔫', team: 'mafia', hint: 'Ночью вместе с мафией выбираешь жертву. Днём притворяйся мирным.' },
  don: { title: 'Дон мафии', emoji: '🎩', team: 'mafia', hint: 'Глава мафии. Ночью ещё и ищешь шерифа.' },
  doctor: { title: 'Доктор', emoji: '💉', team: 'city', hint: 'Ночью лечишь одного игрока. Себя — не два раза подряд.' },
  sheriff: { title: 'Шериф', emoji: '⭐', team: 'city', hint: 'Ночью проверяешь одного игрока: мафия или нет.' },
  maniac: { title: 'Маньяк', emoji: '🔪', team: 'solo', hint: 'Играешь сам за себя. Ночью убиваешь. Побеждаешь, оставшись один на один.' },
  civilian: { title: 'Мирный житель', emoji: '🙂', team: 'city', hint: 'Ночью спишь. Днём вычисли мафию и голосуй.' },
};

export type MafiaSettings = {
  playerCount: number;
  mafiaCount: number;
  autoMafiaCount: boolean;
  don: boolean;
  doctor: boolean;
  sheriff: boolean;
  maniac: boolean;
};

export const MAFIA_MIN_PLAYERS = 4;

/** Рекомендуемое число мафии: примерно каждый четвёртый */
export function recommendedMafia(n: number): number {
  return Math.max(1, Math.round(n / 4));
}

/** Мафии строго меньше, чем всех остальных, иначе она выигрывает сразу */
export function maxMafia(n: number): number {
  return Math.max(1, Math.floor((n - 1) / 2));
}

export function resolveMafiaCount(s: MafiaSettings): number {
  const k = s.autoMafiaCount ? recommendedMafia(s.playerCount) : s.mafiaCount;
  return Math.max(1, Math.min(k, maxMafia(s.playerCount)));
}

/** Какие спецроли реально влезают в партию при таком числе игроков */
export function buildRoleList(s: MafiaSettings): MafiaRole[] {
  const n = s.playerCount;
  const k = resolveMafiaCount(s);
  const mafia: MafiaRole[] = Array.from({ length: k }, (_, i) => (i === 0 && s.don && k >= 2 ? 'don' : 'mafia'));
  const city: MafiaRole[] = [];
  // оставляем хотя бы двух обычных мирных
  const room = () => n - k - city.length - 2;
  if (s.sheriff && room() > 0) city.push('sheriff');
  if (s.doctor && room() > 0) city.push('doctor');
  if (s.maniac && n >= 7 && room() > 0) city.push('maniac');
  while (mafia.length + city.length < n) city.push('civilian');
  return [...mafia, ...city];
}

export type MafiaAssignment = { playerId: string; role: MafiaRole };

/**
 * Раздача ролей. Мафия выбирается тем же анти-серийным весом, что и шпион
 * (тот, кто был мафией в прошлой партии, при 5+ игроках не станет ею снова),
 * спецроли города раздаются случайно среди остальных.
 */
export function assignMafiaRoles(
  players: readonly Player[],
  s: MafiaSettings,
  history: SpyHistory,
  rng: Rng,
): { assignments: MafiaAssignment[]; history: SpyHistory } {
  const roles = buildRoleList({ ...s, playerCount: players.length });
  const mafiaRoles = roles.filter((r) => MAFIA_ROLE_INFO[r].team === 'mafia');
  const otherRoles = shuffle(roles.filter((r) => MAFIA_ROLE_INFO[r].team !== 'mafia'), rng);
  const mafiaIds = pickSpies(players, history, mafiaRoles.length, players.length >= 5, rng);
  const rest = shuffle(players.filter((p) => !mafiaIds.includes(p.id)), rng);
  const byId = new Map<string, MafiaRole>();
  mafiaIds.forEach((id, i) => byId.set(id, mafiaRoles[i]));
  rest.forEach((p, i) => byId.set(p.id, otherRoles[i]));
  return {
    assignments: players.map((p) => ({ playerId: p.id, role: byId.get(p.id)! })),
    history: updateHistory(history, players, mafiaIds, players[0].id),
  };
}

export type MafiaOutcome = 'city' | 'mafia' | 'maniac' | null;

/** Проверка победы по живым игрокам */
export function mafiaWinner(alive: readonly MafiaRole[]): MafiaOutcome {
  const mafia = alive.filter((r) => MAFIA_ROLE_INFO[r].team === 'mafia').length;
  const maniac = alive.filter((r) => r === 'maniac').length;
  const others = alive.length - mafia - maniac;
  if (maniac && alive.length <= 2 && mafia === 0) return 'maniac';
  if (mafia === 0 && maniac === 0) return 'city';
  if (mafia > 0 && maniac === 0 && mafia >= others) return 'mafia';
  return null;
}

/** Сценарий ночи для ведущего — только роли, которые есть в партии */
export function nightScript(roles: readonly MafiaRole[], firstNight: boolean): string[] {
  const has = (r: MafiaRole) => roles.includes(r);
  const steps = ['🌙 Город засыпает. Все закрывают глаза.'];
  if (firstNight) steps.push('🔫 Мафия просыпается и знакомится друг с другом. Мафия засыпает.');
  else steps.push('🔫 Мафия просыпается и молча выбирает жертву. Мафия засыпает.');
  if (has('don') && !firstNight) steps.push('🎩 Дон просыпается и ищет шерифа (ведущий кивает «да/нет»). Дон засыпает.');
  if (has('maniac') && !firstNight) steps.push('🔪 Маньяк просыпается и выбирает жертву. Маньяк засыпает.');
  if (has('doctor') && !firstNight) steps.push('💉 Доктор просыпается и выбирает, кого лечить. Доктор засыпает.');
  if (has('sheriff') && !firstNight) steps.push('⭐ Шериф просыпается и проверяет игрока (ведущий кивает «да/нет»). Шериф засыпает.');
  steps.push('☀️ Город просыпается. Ведущий объявляет, кто выбыл ночью.');
  return steps;
}
