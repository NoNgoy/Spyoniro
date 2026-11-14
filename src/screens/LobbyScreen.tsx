import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, Screen, Section, Segmented, Stepper, ToggleRow, ui } from '../components/ui';
import { maxSpies, randomSpyRange } from '../logic/randomizer';
import type { GameMode } from '../logic/types';
import type { Nav } from '../navigation';
import { MAX_PLAYERS, MIN_PLAYERS, useGame } from '../state/GameContext';
import { colors, font } from '../theme';

const MODES: { value: GameMode; label: string; hint: string }[] = [
  { value: 'classic', label: 'Классика', hint: 'Шпион видит «ТЫ ШПИОН» и не знает карточку.' },
  { value: 'blind', label: 'Слепой', hint: 'Шпион не знает, что он шпион: у него похожая, но другая карточка.' },
  {
    value: 'mixed',
    label: 'Смешанный',
    hint: 'При 2+ шпионах: один классический, остальные слепые. При одном — каждый раунд случайно.',
  },
];

const TIMERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function LobbyScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const st = g.settings;
  const [showNames, setShowNames] = useState(false);
  const spyMax = maxSpies(st.playerCount);
  const [rLo, rHi] = randomSpyRange(st.playerCount);
  const civilians = st.playerCount - st.spyCount;

  const togglePool = (id: string) => {
    const sel = st.selectedPoolIds.includes(id)
      ? st.selectedPoolIds.filter((x) => x !== id)
      : [...st.selectedPoolIds, id];
    g.updateSettings({ selectedPoolIds: sel });
  };

  const start = () => {
    const err = g.startRound();
    if (err) Alert.alert('Не получается начать', err);
    else nav.push({ name: 'reveal' });
  };

  const totalCards = st.selectedPoolIds.reduce((s, id) => {
    const p = g.poolById(id);
    if (!p) return s;
    const hidden = new Set(g.hidden[id] ?? []);
    return s + p.cards.filter((c) => !hidden.has(c.id)).length;
  }, 0);

  return (
    <Screen
      title="🕵️ Шпион"
      onBack={() => nav.reset({ name: 'home' })}
      footer={
        <Button
          big
          label={`Начать раунд · ${st.playerCount} игроков`}
          onPress={start}
          disabled={!st.selectedPoolIds.length}
        />
      }
    >
      <Text style={ui.muted}>Передавайте телефон по кругу. Сыграно раундов: {g.roundsPlayed}</Text>

      <Section title="Игроки">
        <Stepper
          label="Количество"
          value={st.playerCount}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          onChange={(v) => g.updateSettings({ playerCount: v })}
        />
        <Pressable onPress={() => setShowNames((v) => !v)} style={styles.link}>
          <Text style={styles.linkText}>{showNames ? 'Скрыть имена ▲' : 'Изменить имена ▼'}</Text>
        </Pressable>
        {showNames ? (
          <View style={{ gap: 8 }}>
            {g.players.slice(0, st.playerCount).map((p, i) => (
              <Input
                key={p.id}
                value={p.name}
                placeholder={`Игрок ${i + 1}`}
                onChangeText={(t) => g.setPlayerName(i, t)}
                maxLength={24}
                returnKeyType="next"
              />
            ))}
            <Button variant="ghost" label="Сбросить имена" onPress={g.resetPlayerNames} />
          </View>
        ) : (
          <Text style={ui.muted} numberOfLines={2}>
            {g.activePlayers.map((p) => p.name).join(', ')}
          </Text>
        )}
      </Section>

      <Section title="Режим игры" hint={MODES.find((m) => m.value === st.mode)!.hint}>
        <Segmented options={MODES} value={st.mode} onChange={(v) => g.updateSettings({ mode: v })} />
      </Section>

      <Section
        title="Шпионы"
        hint={
          st.randomSpyCount
            ? `Каждый раунд случайно: ${rLo === rHi ? rLo : `${rLo}–${rHi}`}`
            : `Мирных: ${civilians}. Максимум шпионов: ${spyMax}`
        }
      >
        <ToggleRow
          label="Случайное число шпионов"
          value={st.randomSpyCount}
          onChange={(v) => g.updateSettings({ randomSpyCount: v })}
        />
        {!st.randomSpyCount ? (
          <Stepper
            label="Шпионов"
            value={st.spyCount}
            min={1}
            max={spyMax}
            onChange={(v) => g.updateSettings({ spyCount: v })}
          />
        ) : null}
        <ToggleRow
          label="Хаос-режим"
          hint={`Шанс ${Math.round(st.chaosChance * 100)}% за раунд: поровну «все шпионы» и «шпионов нет»`}
          value={st.chaosMode}
          onChange={(v) => g.updateSettings({ chaosMode: v })}
        />
        {st.chaosMode ? (
          <View style={ui.wrap}>
            {[0.05, 0.1, 0.15, 0.25].map((c) => (
              <Chip
                key={c}
                label={`${Math.round(c * 100)}%`}
                active={Math.abs(st.chaosChance - c) < 0.001}
                onPress={() => g.updateSettings({ chaosChance: c })}
              />
            ))}
          </View>
        ) : null}
        <ToggleRow
          label="Жёсткий анти-повтор"
          hint="Шпион прошлого раунда не станет шпионом снова (при 4+ игроках)"
          value={st.hardAntiRepeat}
          onChange={(v) => g.updateSettings({ hardAntiRepeat: v })}
        />
      </Section>

      <Section title="Категории" hint={`Выбрано карточек: ${totalCards}. Можно отметить несколько.`}>
        <View style={ui.wrap}>
          {g.pools.map((p) => (
            <Chip
              key={p.id}
              label={`${p.icon} ${p.name}`}
              color={p.color}
              active={st.selectedPoolIds.includes(p.id)}
              onPress={() => togglePool(p.id)}
            />
          ))}
        </View>
        <Button variant="secondary" label="📚 Мои пулы и карточки" onPress={() => nav.push({ name: 'pools' })} />
      </Section>

      <Section title="Правила раунда">
        <Text style={styles.label}>Таймер</Text>
        <View style={ui.wrap}>
          {TIMERS.map((m) => (
            <Chip
              key={m}
              label={m === 0 ? 'Без таймера' : `${m} мин`}
              active={st.timerMinutes === m}
              onPress={() => g.updateSettings({ timerMinutes: m })}
            />
          ))}
        </View>
        <ToggleRow
          label="Подсказка для шпиона"
          hint="Классический шпион видит название категории"
          value={st.spyHint}
          onChange={(v) => g.updateSettings({ spyHint: v })}
          disabled={st.mode === 'blind'}
        />
        <ToggleRow
          label="Показывать теги карточки"
          hint="Например: «Легендарная», «Заклинание», «RU»"
          value={st.showTags}
          onChange={(v) => g.updateSettings({ showTags: v })}
        />
      </Section>

      <Button
        variant="ghost"
        label="Сбросить статистику и колоды"
        onPress={() =>
          Alert.alert('Сбросить?', 'История шпионов и сыгранные карточки будут обнулены.', [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Сбросить', style: 'destructive', onPress: g.resetStats },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { paddingVertical: 4 },
  linkText: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  label: { color: colors.text, fontSize: font.body, fontWeight: '600' },
});
