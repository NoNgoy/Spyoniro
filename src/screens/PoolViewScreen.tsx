import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Screen, Section, ui } from '../components/ui';
import { exportPoolCode } from '../logic/customPools';
import type { Card } from '../logic/types';
import type { Nav } from '../navigation';
import { useGame } from '../state/GameContext';
import { colors, radius } from '../theme';

/** Просмотр встроенного пула: карточки по кластерам, можно скрывать ненужные */
export function PoolViewScreen({ nav, poolId }: { nav: Nav; poolId: string }) {
  const g = useGame();
  const pool = g.poolById(poolId);
  if (!pool) return null;
  const hidden = new Set(g.hidden[poolId] ?? []);
  const groups = new Map<string, Card[]>();
  pool.cards.forEach((c) => {
    const k = c.cluster ?? '';
    groups.set(k, [...(groups.get(k) ?? []), c]);
  });

  return (
    <Screen title={`${pool.icon} ${pool.name}`} onBack={nav.back}>
      <Text style={ui.muted}>
        Видно {pool.cards.length - hidden.size} из {pool.cards.length}. Нажмите на карточку, чтобы скрыть её из игры.
        Карточки одной группы — близкие пары для «Слепого шпиона».
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} variant="secondary" label="Показать все" onPress={() => g.setHiddenAll(poolId, false)} />
        <Button
          style={{ flex: 1 }}
          variant="secondary"
          label="Поделиться"
          onPress={async () => {
            await Clipboard.setStringAsync(exportPoolCode(pool));
            Alert.alert('Скопировано', 'Код пула в буфере обмена. Его можно импортировать как свой пул и отредактировать.');
          }}
        />
      </View>
      {[...groups.entries()].map(([cl, cards]) => (
        <Section key={cl} title={pool.clusterLabels[cl] ?? 'Без группы'}>
          <View style={ui.wrap}>
            {cards.map((c) => {
              const off = hidden.has(c.id);
              return (
                <Pressable key={c.id} onPress={() => g.toggleHidden(poolId, c.id)} style={[styles.card, off && styles.off]}>
                  <Text style={[styles.text, off && { textDecorationLine: 'line-through', color: colors.muted }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  off: { opacity: 0.5, borderStyle: 'dashed' },
  text: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
