import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, ui } from '../components/ui';
import type { Nav, Route } from '../navigation';
import { colors, font, radius } from '../theme';

const GAMES: { route: Route; emoji: string; title: string; text: string; color: string }[] = [
  {
    route: { name: 'lobby' },
    emoji: '🕵️',
    title: 'Шпион',
    text: 'Все знают слово, кроме шпиона. Или шпион сам не знает, что он шпион.',
    color: '#7C5CFF',
  },
  {
    route: { name: 'aliasSetup' },
    emoji: '🗣️',
    title: 'Объясни слово',
    text: 'Команды объясняют слова на время, не называя их. Кто больше угадает.',
    color: '#22C55E',
  },
  {
    route: { name: 'headsSetup' },
    emoji: '🤔',
    title: 'Кто я?',
    text: 'Телефон на лоб: друзья объясняют, ты угадываешь. Наклон вниз — угадал.',
    color: '#F59E0B',
  },
  {
    route: { name: 'mafiaSetup' },
    emoji: '🔫',
    title: 'Мафия',
    text: 'Тайная раздача ролей и подсказки ведущему: ночь, день, голосование.',
    color: '#EF4444',
  },
];

export function HomeScreen({ nav }: { nav: Nav }) {
  return (
    <Screen>
      <View style={{ paddingTop: 8, paddingBottom: 4 }}>
        <Text style={ui.h1}>Игры для компании</Text>
        <Text style={[ui.muted, { marginTop: 4 }]}>Один телефон на всех. Без интернета.</Text>
      </View>
      {GAMES.map((gm) => (
        <Pressable
          key={gm.title}
          onPress={() => nav.push(gm.route)}
          style={({ pressed }) => [styles.card, { borderColor: gm.color }, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.emoji}>{gm.emoji}</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.title}>{gm.title}</Text>
            <Text style={ui.muted}>{gm.text}</Text>
          </View>
        </Pressable>
      ))}
      <Pressable onPress={() => nav.push({ name: 'pools' })} style={{ alignItems: 'center', padding: 12 }}>
        <Text style={{ color: colors.accent, fontSize: font.body, fontWeight: '700' }}>📚 Мои пулы и карточки</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: 18,
  },
  emoji: { fontSize: 44 },
  title: { color: colors.text, fontSize: font.h2, fontWeight: '900' },
});
