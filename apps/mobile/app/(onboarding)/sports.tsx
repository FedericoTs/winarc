import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SPORT_KEYS, customSportKey } from '@winarc/domain';
import { Body, Button, Chip, Display, Eyebrow, Screen } from '@/components/ui';
import { useOnboarding } from '@/state/arc';
import { colors } from '@/theme/tokens';

export default function Sports() {
  const { sports, customSports, toggleSport, addCustomSport } = useOnboarding();
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  function addCustom() {
    const name = custom.trim();
    if (!name) return;
    addCustomSport(customSportKey(name), name);
    setCustom('');
    setShowCustom(false);
  }

  return (
    <Screen>
      <Eyebrow>01 · Identity</Eyebrow>
      <Display size={44}>What are you{'\n'}training for?</Display>
      <Body muted>Pick one to three, or name your own. This sets your proof scene, your templates and who you get drafted with.</Body>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 16 }}>
        {SPORT_KEYS.map((k) => (
          <Chip key={k} label={k} on={sports.includes(k)} onPress={() => toggleSport(k)} />
        ))}
        {customSports.map((c) => (
          <Chip key={c.key} label={c.name.toUpperCase()} on={sports.includes(c.key)} onPress={() => toggleSport(c.key)} />
        ))}
        <Chip label="+ CUSTOM" onPress={() => setShowCustom((v) => !v)} />
        {showCustom ? (
          <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
            <TextInput
              value={custom}
              onChangeText={setCustom}
              placeholder="Name it, e.g. Cold plunge"
              placeholderTextColor={colors.ink3}
              maxLength={22}
              onSubmitEditing={addCustom}
              style={{ flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink }}
            />
            <Button title="Add" onPress={addCustom} />
          </View>
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Build my contract" onPress={() => router.push('/(onboarding)/contract')} />
        </View>
      </View>
    </Screen>
  );
}
