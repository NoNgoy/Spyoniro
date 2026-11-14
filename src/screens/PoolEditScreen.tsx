import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Input, Screen, Section, ui } from '../components/ui';
import { exportPoolCode, exportPoolJson, mergeCards, parseBulkInput, type CustomCard, type CustomPool } from '../logic/customPools';
import type { Nav } from '../navigation';
import { useGame } from '../state/GameContext';
import { colors, POOL_COLORS, POOL_ICONS, radius } from '../theme';
import { newPoolId } from './ImportScreen';

const BULK_HINT = `По одному слову в строке. Можно вставить 30–50 слов сразу.

Пиво :: Квас       ← пара для «Слепого шпиона»
Самса | выпечка    ← тег-кластер`;

export function PoolEditScreen({ nav, poolId }: { nav: Nav; poolId: string | null }) {
  const g = useGame();
  const existing = poolId ? g.customPools.find((p) => p.id === poolId) : undefined;
  const [id] = useState(() => existing?.id ?? newPoolId());
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? POOL_ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? POOL_COLORS[6]);
  const [cards, setCards] = useState<CustomCard[]>(existing?.cards ?? []);
  const [bulk, setBulk] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const parsed = useMemo(() => parseBulkInput(bulk), [bulk]);

  const pool: CustomPool = { id, name: name.trim() || 'Мой пул', icon, color, cards };
  const save = (next: Partial<CustomPool> = {}) => g.saveCustomPool({ ...pool, ...next });

  const addBulk = () => {
    const merged = mergeCards(cards, parsed);
    setCards(merged);
    setBulk('');
    save({ cards: merged });
  };

  const updateCard = (i: number, patch: Partial<CustomCard>) => {
    const next = cards.map((c, j) => (j === i ? { ...c, ...patch } : c));
    setCards(next);
  };

  const removeCard = (i: number) => {
    const next = cards.filter((_, j) => j !== i);
    setCards(next);
    setEditing(null);
    save({ cards: next });
  };

  const done = () => {
    if (cards.length || existing) save();
    nav.back();
  };

  const copy = async (kind: 'code' | 'json') => {
    await Clipboard.setStringAsync(kind === 'code' ? exportPoolCode(pool) : exportPoolJson(pool));
    Alert.alert('Скопировано', kind === 'code' ? 'Код пула в буфере обмена — отправьте его друзьям.' : 'JSON в буфере обмена.');
  };

  return (
    <Screen
      title={existing ? 'Редактировать пул' : 'Новый пул'}
      onBack={done}
      footer={<Button big label="Сохранить" onPress={done} />}
    >
      <Section title="Название и вид">
        <Input value={name} onChangeText={setName} placeholder="Например: Наша компания" maxLength={40} />
        <View style={ui.wrap}>
          {POOL_ICONS.map((e) => (
            <Pressable key={e} onPress={() => setIcon(e)} style={[styles.iconBtn, icon === e && { borderColor: color }]}>
              <Text style={{ fontSize: 24 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
        <View style={ui.wrap}>
          {POOL_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]} />
          ))}
        </View>
      </Section>

      <Section title="Быстрый ввод списком" hint={BULK_HINT}>
        <Input
          value={bulk}
          onChangeText={setBulk}
          multiline
          placeholder={'Слово 1\nСлово 2\nСлово 3 :: Слово 4'}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
        <Button label={parsed.length ? `Добавить ${parsed.length} карточек` : 'Добавить'} onPress={addBulk} disabled={!parsed.length} />
      </Section>

      <Section title={`Карточки (${cards.length})`} hint="Нажмите на карточку, чтобы изменить похожие слова или кластер">
        {cards.length === 0 ? <Text style={ui.muted}>Пока пусто.</Text> : null}
        {cards.map((c, i) =>
          editing === i ? (
            <View key={i} style={styles.editBox}>
              <Input value={c.name} onChangeText={(t) => updateCard(i, { name: t })} placeholder="Слово" />
              <Input
                value={c.similar.join(', ')}
                onChangeText={(t) => updateCard(i, { similar: t.split(',').map((x) => x.trim()).filter(Boolean) })}
                placeholder="Похожие слова через запятую"
              />
              <Input
                value={c.cluster?.startsWith('pair:') ? '' : c.cluster ?? ''}
                onChangeText={(t) => updateCard(i, { cluster: t.trim() || undefined })}
                placeholder="Кластер (необязательно)"
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  style={{ flex: 1 }}
                  label="Готово"
                  onPress={() => {
                    setEditing(null);
                    save();
                  }}
                />
                <Button style={{ flex: 1 }} variant="danger" label="Удалить" onPress={() => removeCard(i)} />
              </View>
            </View>
          ) : (
            <Pressable key={i} style={styles.cardRow} onPress={() => setEditing(i)}>
              <Text style={[ui.text, { flex: 1 }]}>{c.name}</Text>
              {c.similar.length ? <Text style={ui.muted}>≈ {c.similar.join(', ')}</Text> : null}
              {c.cluster && !c.cluster.startsWith('pair:') ? <Text style={ui.muted}>#{c.cluster}</Text> : null}
            </Pressable>
          ),
        )}
      </Section>

      <Section title="Поделиться пулом">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button style={{ flex: 1 }} variant="secondary" label="Код" onPress={() => copy('code')} disabled={!cards.length} />
          <Button style={{ flex: 1 }} variant="secondary" label="JSON" onPress={() => copy('json')} disabled={!cards.length} />
        </View>
      </Section>

      {existing ? (
        <Button
          variant="ghost"
          label="🗑 Удалить пул"
          onPress={() =>
            Alert.alert('Удалить пул?', `«${existing.name}» будет удалён навсегда.`, [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Удалить',
                style: 'destructive',
                onPress: () => {
                  g.deleteCustomPool(existing.id);
                  nav.back();
                },
              },
            ])
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  swatchOn: { borderWidth: 3, borderColor: '#fff' },
  cardRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    padding: 12,
    flexWrap: 'wrap',
  },
  editBox: { gap: 8, backgroundColor: colors.surface2, borderRadius: radius.sm, padding: 12 },
});
