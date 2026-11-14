import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Assignment, Card, Pool } from '../logic/types';
import { colors, font, radius } from '../theme';

/**
 * Карточка роли. ВАЖНО: мирный и слепой шпион рендерятся одной и той же
 * веткой кода — отличается только текст слова, поэтому по интерфейсу
 * догадаться о роли невозможно.
 */
export function RoleCard({
  assignment,
  card,
  pool,
  categoryPool,
  showTags,
  spyHint,
}: {
  assignment: Assignment;
  card?: Card;
  /** Пул карточки игрока */
  pool?: Pool;
  /** Пул карточки мирных — для подсказки шпиону */
  categoryPool?: Pool;
  showTags: boolean;
  spyHint: boolean;
}) {
  if (assignment.role === 'classicSpy' || !card) {
    return (
      <View style={[styles.card, { backgroundColor: '#2A0F16', borderColor: colors.danger }]}>
        <Text style={styles.spyEmoji}>🕵️</Text>
        <Text style={styles.spyTitle}>ТЫ ШПИОН</Text>
        {spyHint && categoryPool ? (
          <Text style={styles.category}>
            Категория: {categoryPool.icon} {categoryPool.name}
          </Text>
        ) : (
          <Text style={styles.category}>Выясни слово по вопросам других</Text>
        )}
      </View>
    );
  }
  const color = pool?.color ?? colors.accent;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: color }]}>
      <Text style={styles.category}>
        {pool?.icon} {pool?.name}
      </Text>
      <Text style={styles.word} adjustsFontSizeToFit numberOfLines={3}>
        {card.name}
      </Text>
      {showTags && card.tags.length ? (
        <View style={styles.tags}>
          {card.tags.map((t) => (
            <View key={t} style={[styles.tag, { borderColor: color }]}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: 24,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  category: { color: colors.muted, fontSize: font.body, fontWeight: '600', textAlign: 'center' },
  word: { color: colors.text, fontSize: font.huge, fontWeight: '900', textAlign: 'center' },
  spyEmoji: { fontSize: 64 },
  spyTitle: { color: colors.danger, fontSize: font.huge, fontWeight: '900', letterSpacing: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { color: colors.text, fontSize: font.small, fontWeight: '600' },
});
