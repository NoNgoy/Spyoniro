import type { Pool } from '../logic/types';
import { normalizePool, type RawPool } from '../logic/pools';
import clashRoyale from './pools/clash_royale.json';
import bloggers from './pools/bloggers.json';
import games from './pools/games.json';
import moviesAnime from './pools/movies_anime.json';
import memes from './pools/memes.json';
import classic from './pools/classic.json';

export const RAW_POOLS: RawPool[] = [
  clashRoyale as RawPool,
  bloggers as RawPool,
  games as RawPool,
  moviesAnime as RawPool,
  memes as RawPool,
  classic as RawPool,
];

export const BUILTIN_POOLS: Pool[] = RAW_POOLS.map((p) => normalizePool(p, true));
