import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Screen, Section, ui } from '../components/ui';
import type { Pool } from '../logic/types';
import type { Nav } from '../navigation';
import { useGame } from '../state/GameContext';
import { colors, radius } from '../theme';

export function PoolsScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const builtIn = g.pools.filter((p) => p.builtIn);
  const custom = g.pools.filter((p) => !p.builtIn);

  const Row = ({ p }: { p: Pool }) => {
    const hidden = (g.hidden[p.id] ?? []).length;
    return (
      <Pressable
        style={({ pressed }) => [styles.row, { borderLeftColor: p.color }, pressed && { opacity: 0.8 }]}
        onPress={() => nav.push(p.builtIn ? { name: 'poolView', poolId: p.id } : { name: 'poolEdit', poolId: p.id })}
      >
        <Text style={styles.icon}>{p.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={ui.h3}>{p.name}</Text>
          <Text style={ui.muted}>
            {p.cards.length} карточек{hidden ? ` · скрыто ${hidden}` : ''}
          </Text>
        </View>
        <Text style={ui.muted}>›</Text>
      </Pressable>
    );
  };

  return (
    <Screen title="Мои пулы" onBack={nav.back}>
      <Section title="Свои пулы" hint="Создайте категорию из своих слов или вставьте код от друга">
        {custom.length === 0 ? <Text style={ui.muted}>Пока нет своих пулов.</Text> : null}
        {custom.map((p) => (
          <Row key={p.id} p={p} />
        ))}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button style={{ flex: 1 }} label="＋ Создать" onPress={() => nav.push({ name: 'poolEdit', poolId: null })} />
          <Button style={{ flex: 1 }} variant="secondary" label="⬇ Импорт" onPress={() => nav.push({ name: 'import' })} />
        </View>
      </Section>
      <Section title="Встроенные пулы" hint="Можно скрыть ненужные карточки">
        {builtIn.map((p) => (
          <Row key={p.id} p={p} />
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 14,
    borderLeftWidth: 4,
  },
  icon: { fontSize: 28 },
});
