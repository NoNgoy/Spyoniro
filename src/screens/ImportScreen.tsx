import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Input, Screen, ui } from '../components/ui';
import { importPool } from '../logic/customPools';
import type { Nav } from '../navigation';
import { useGame } from '../state/GameContext';

export const newPoolId = () => `custom_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function ImportScreen({ nav }: { nav: Nav }) {
  const g = useGame();
  const [text, setText] = useState('');

  const doImport = () => {
    try {
      const data = importPool(text);
      const id = newPoolId();
      g.saveCustomPool({ id, ...data });
      Alert.alert('Готово', `Пул «${data.name}» добавлен: ${data.cards.length} карточек.`);
      nav.replace({ name: 'poolEdit', poolId: id });
    } catch (e: any) {
      Alert.alert('Ошибка импорта', e?.message ?? String(e));
    }
  };

  return (
    <Screen title="Импорт пула" onBack={nav.back}>
      <Text style={ui.muted}>Вставьте код (начинается с SPY1:) или JSON, которым с вами поделились.</Text>
      <Input
        value={text}
        onChangeText={setText}
        multiline
        placeholder="SPY1:…"
        style={{ minHeight: 180, textAlignVertical: 'top' }}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <Button variant="secondary" label="📋 Вставить из буфера" onPress={async () => setText(await Clipboard.getStringAsync())} />
      <Button big label="Импортировать" onPress={doImport} disabled={!text.trim()} />
    </Screen>
  );
}
