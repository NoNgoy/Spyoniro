import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../state/GameContext';
import { colors, font } from '../theme';
import { Button, Chip, Input, ui } from './ui';

/** Выбор категорий (несколько сразу) — общий для всех словесных игр */
export function PoolPicker({
  selected,
  onChange,
  onManage,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  onManage?: () => void;
}) {
  const g = useGame();
  const total = selected.reduce((s, id) => {
    const p = g.poolById(id);
    if (!p) return s;
    const hidden = new Set(g.hidden[id] ?? []);
    return s + p.cards.filter((c) => !hidden.has(c.id)).length;
  }, 0);
  return (
    <View style={{ gap: 10 }}>
      <Text style={ui.muted}>Выбрано карточек: {total}. Можно отметить несколько.</Text>
      <View style={ui.wrap}>
        {g.pools.map((p) => (
          <Chip
            key={p.id}
            label={`${p.icon} ${p.name}`}
            color={p.color}
            active={selected.includes(p.id)}
            onPress={() => onChange(selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id])}
          />
        ))}
      </View>
      {onManage ? <Button variant="secondary" label="📚 Мои пулы и карточки" onPress={onManage} /> : null}
    </View>
  );
}

/** Сворачиваемый список имён (общий список игроков на все игры) */
export function PlayerNames({ count }: { count: number }) {
  const g = useGame();
  const [open, setOpen] = useState(false);
  const names = g.players.slice(0, count).map((p, i) => p.name.trim() || `Игрок ${i + 1}`);
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => setOpen((v) => !v)} style={{ paddingVertical: 4 }}>
        <Text style={styles.link}>{open ? 'Скрыть имена ▲' : 'Изменить имена ▼'}</Text>
      </Pressable>
      {open ? (
        <>
          {g.players.slice(0, count).map((p, i) => (
            <Input
              key={p.id}
              value={p.name}
              placeholder={`Игрок ${i + 1}`}
              onChangeText={(t) => g.setPlayerName(i, t)}
              maxLength={24}
            />
          ))}
          <Button variant="ghost" label="Сбросить имена" onPress={g.resetPlayerNames} />
        </>
      ) : (
        <Text style={ui.muted} numberOfLines={2}>
          {names.join(', ')}
        </Text>
      )}
    </View>
  );
}

/** Таймер обратного отсчёта, устойчивый к подтормаживаниям (считает от Date.now) */
export function useCountdown(totalMs: number, running: boolean, onEnd?: () => void) {
  const [left, setLeft] = useState(totalMs);
  const endAt = React.useRef(0);
  const leftRef = React.useRef(totalMs);
  leftRef.current = left;
  const onEndRef = React.useRef(onEnd);
  onEndRef.current = onEnd;
  React.useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + leftRef.current;
    const t = setInterval(() => {
      const l = Math.max(0, endAt.current - Date.now());
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        onEndRef.current?.();
      }
    }, 200);
    return () => clearInterval(t);
  }, [running]);
  return { left, reset: () => setLeft(totalMs) };
}

export const fmtTime = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const styles = StyleSheet.create({
  link: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
});
