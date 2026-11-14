import type { Card, Pool } from './types';
import { cardId } from './pools';

/** Пользовательский пул в хранилище */
export type CustomCard = { name: string; cluster?: string; similar: string[] };
export type CustomPool = {
  id: string;
  name: string;
  icon: string;
  color: string;
  cards: CustomCard[];
};

const norm = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е');

/**
 * Разбор быстрого ввода списком. Каждая строка — одна из форм:
 *   Слово
 *   Слово 1 :: Слово 2 [:: Слово 3]   — парные (близкие) карточки
 *   Слово | кластер                    — карточка с тегом кластера
 * Пустые строки и дубликаты пропускаются.
 */
export function parseBulkInput(text: string): CustomCard[] {
  const out: CustomCard[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.includes('::')) {
      const names = line.split('::').map((s) => s.trim()).filter(Boolean);
      const uniq = names.filter((n, i) => names.findIndex((m) => norm(m) === norm(n)) === i);
      if (uniq.length === 1) out.push({ name: uniq[0], similar: [] });
      else
        for (const n of uniq)
          out.push({ name: n, cluster: `pair:${uniq[0]}`, similar: uniq.filter((m) => m !== n) });
      continue;
    }
    const bar = line.indexOf('|');
    if (bar > 0) {
      const name = line.slice(0, bar).trim();
      const cluster = line.slice(bar + 1).trim();
      if (name) out.push({ name, cluster: cluster || undefined, similar: [] });
      continue;
    }
    out.push({ name: line, similar: [] });
  }
  return mergeCards([], out);
}

/** Добавляет карточки в пул: одинаковые названия не дублируются, похожие — объединяются */
export function mergeCards(existing: CustomCard[], incoming: CustomCard[]): CustomCard[] {
  const result = existing.map((c) => ({ ...c, similar: [...c.similar] }));
  for (const c of incoming) {
    const found = result.find((r) => norm(r.name) === norm(c.name));
    if (found) {
      if (!found.cluster && c.cluster) found.cluster = c.cluster;
      for (const s of c.similar) if (!found.similar.some((x) => norm(x) === norm(s))) found.similar.push(s);
    } else result.push({ ...c, similar: [...c.similar] });
  }
  return result;
}

export function customToPool(cp: CustomPool): Pool {
  const byNorm = new Map(cp.cards.map((c) => [norm(c.name), c.name]));
  const clusterLabels: Record<string, string> = {};
  const cards: Card[] = cp.cards.map((c) => {
    if (c.cluster) clusterLabels[c.cluster] = c.cluster.startsWith('pair:') ? 'Пара' : c.cluster;
    return {
      id: cardId(cp.id, c.name),
      name: c.name,
      poolId: cp.id,
      cluster: c.cluster,
      similarIds: c.similar
        .map((s) => byNorm.get(norm(s)))
        .filter((s): s is string => !!s)
        .map((s) => cardId(cp.id, s)),
      tags: c.cluster && !c.cluster.startsWith('pair:') ? [c.cluster] : [],
    };
  });
  return { id: cp.id, name: cp.name, icon: cp.icon, color: cp.color, builtIn: false, clusterLabels, cards };
}

// ---------------------------------------------------------------------------
// Импорт / экспорт
// ---------------------------------------------------------------------------

type ExportShape = {
  format: 'spy-pool';
  v: 1;
  name: string;
  icon: string;
  color: string;
  cards: { n: string; c?: string; s?: string[] }[];
};

export function exportPoolJson(cp: CustomPool | Pool): string {
  const cards =
    'builtIn' in cp
      ? (cp as Pool).cards.map((c) => ({
          name: c.name,
          cluster: c.cluster ? (cp as Pool).clusterLabels[c.cluster] ?? c.cluster : undefined,
          similar: c.similarIds
            .map((id) => (cp as Pool).cards.find((x) => x.id === id)?.name)
            .filter((x): x is string => !!x),
        }))
      : (cp as CustomPool).cards;
  const data: ExportShape = {
    format: 'spy-pool',
    v: 1,
    name: cp.name,
    icon: cp.icon,
    color: cp.color,
    cards: cards.map((c) => {
      const o: { n: string; c?: string; s?: string[] } = { n: c.name };
      if (c.cluster) o.c = c.cluster;
      if (c.similar.length) o.s = c.similar;
      return o;
    }),
  };
  return JSON.stringify(data);
}

export const CODE_PREFIX = 'SPY1:';

export function exportPoolCode(cp: CustomPool | Pool): string {
  return CODE_PREFIX + base64EncodeUtf8(exportPoolJson(cp));
}

/** Принимает код SPY1:… или JSON. Возвращает пул без id (id назначает вызывающий). */
export function importPool(input: string): Omit<CustomPool, 'id'> {
  const text = input.trim();
  let json: string;
  if (text.startsWith(CODE_PREFIX)) json = base64DecodeUtf8(text.slice(CODE_PREFIX.length).replace(/\s+/g, ''));
  else json = text;
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Не удалось прочитать код пула. Проверьте, что он скопирован целиком.');
  }
  if (!data || data.format !== 'spy-pool' || !Array.isArray(data.cards))
    throw new Error('Это не похоже на пул для «Шпиона».');
  const cards = mergeCards(
    [],
    data.cards
      .filter((c: any) => c && typeof c.n === 'string' && c.n.trim())
      .map((c: any) => ({
        name: String(c.n).trim(),
        cluster: typeof c.c === 'string' && c.c ? c.c : undefined,
        similar: Array.isArray(c.s) ? c.s.filter((x: any) => typeof x === 'string') : [],
      })),
  );
  if (!cards.length) throw new Error('В пуле нет карточек.');
  return {
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Импортированный пул',
    icon: typeof data.icon === 'string' && data.icon ? data.icon : '📦',
    color: typeof data.color === 'string' && /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : '#64748B',
    cards,
  };
}

// ---------------------------------------------------------------------------
// Base64 (UTF-8) без зависимостей — atob/btoa не умеют кириллицу
// ---------------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Encode(str: string): number[] {
  const bytes: number[] = [];
  for (const ch of str) {
    let cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return bytes;
}

function utf8Decode(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let cp: number;
    if (b < 0x80) (cp = b), (i += 1);
    else if (b < 0xe0) (cp = ((b & 31) << 6) | (bytes[i + 1] & 63)), (i += 2);
    else if (b < 0xf0) (cp = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)), (i += 3);
    else
      (cp = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63)),
        (i += 4);
    out += String.fromCodePoint(cp);
  }
  return out;
}

export function base64EncodeUtf8(str: string): string {
  const b = utf8Encode(str);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < b.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < b.length ? B64[n & 63] : '=';
  }
  return out;
}

export function base64DecodeUtf8(b64: string): string {
  const clean = b64.replace(/=+$/, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = [0, 1, 2, 3].map((k) => (i + k < clean.length ? B64.indexOf(clean[i + k]) : 0));
    if (chunk.some((x) => x < 0)) throw new Error('Некорректный код пула');
    const n = (chunk[0] << 18) | (chunk[1] << 12) | (chunk[2] << 6) | chunk[3];
    bytes.push((n >> 16) & 255);
    if (i + 2 < clean.length) bytes.push((n >> 8) & 255);
    if (i + 3 < clean.length) bytes.push(n & 255);
  }
  return utf8Decode(bytes);
}
