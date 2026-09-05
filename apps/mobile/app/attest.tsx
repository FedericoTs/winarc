import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { localISODate } from '@winarc/domain';
import { Body, Button, Eyebrow } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { colors, fonts } from '@/theme/tokens';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

type Phase = 'shoot' | 'uploading' | 'done';

/**
 * One photo for a photo or artifact line: the book, the journal, the
 * screenshot on the other screen. No model, no ask. It goes on the board
 * for the squad to see and stamps Bronze.
 */
export default function Attest() {
  const { line } = useLocalSearchParams<{ line: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('shoot');
  const [name, setName] = useState('');
  const [verification, setVerification] = useState<'photo' | 'artifact'>('photo');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!line) return;
      const { data } = await supabase.from('contract_lines').select('name, verification').eq('id', line).maybeSingle();
      if (data) {
        setName(data.name as string);
        if (data.verification === 'artifact') setVerification('artifact');
      }
    })();
  }, [line]);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Body>WinArc needs the camera for the photo.</Body>
        <Button title="Allow camera" onPress={() => requestPermission()} />
      </View>
    );
  }

  async function shoot() {
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.6 });
      if (!shot) return;
      setPhase('uploading');
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Sign in first');
      const path = `${auth.user.id}/${localISODate(new Date(), tz)}/${line}-rear.jpg`;
      const bytes = await (await fetch(shot.uri)).arrayBuffer();
      const { error: uErr } = await supabase.storage.from('proofs').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uErr) throw uErr;
      const { error: rErr } = await supabase.rpc('attest_today', { p_line: line, p_photo_path: path });
      if (rErr) throw rErr;
      track({ name: 'habit_attested', verification });
      setPhase('done');
    } catch (e) {
      setError((e as Error).message);
      setPhase('shoot');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
      <View style={styles.hud}>
        <Text style={styles.hudText}>{name || 'Today'}</Text>
        <Text style={styles.hudText}>{verification === 'artifact' ? 'The artifact' : 'One photo'}</Text>
      </View>
      {phase === 'shoot' ? (
        <View style={styles.shutterWrap}>
          <Pressable onPress={shoot} style={styles.shutter} accessibilityLabel="Capture" />
          <Eyebrow>Goes on the board · stamps Bronze</Eyebrow>
        </View>
      ) : null}
      {phase === 'uploading' ? (
        <View style={styles.panel}>
          <Body>Uploading…</Body>
        </View>
      ) : null}
      {phase === 'done' ? (
        <View style={styles.panel}>
          <Text style={styles.title}>On the board</Text>
          <Body muted>Your squad can see it. Witnessed, not verified: that is the deal for mind and money lines.</Body>
          <Button title="Done" onPress={() => router.back()} />
        </View>
      ) : null}
      {error ? (
        <View style={styles.panel}>
          <Body style={{ color: colors.rose }}>{error}</Body>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  hud: { position: 'absolute', top: 64, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  hudText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink },
  shutterWrap: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', gap: 10 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.85)' },
  panel: { position: 'absolute', left: 20, right: 20, bottom: 30, backgroundColor: 'rgba(11,13,18,0.92)', borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 16, gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 28, textTransform: 'uppercase', color: colors.mint },
});
