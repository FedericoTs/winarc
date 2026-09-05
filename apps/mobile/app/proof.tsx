import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { SEASON_ONE, askCopy, dayOfSeason, localISODate, type AskReason, type Tier } from '@winarc/domain';
import { Body, Button, Eyebrow } from '@/components/ui';
import { evidenceFor, health } from '@/lib/health';
import { supabase } from '@/lib/supabase';
import { Stamp } from '@/components/Stamp';
import { ProofCard, type CardRef } from '@/components/cards';
import { shareCard } from '@/lib/share';
import { track } from '@/lib/analytics';
import { SPORTS, customSport } from '@winarc/domain';
import { colors, fonts } from '@/theme/tokens';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

type Phase = 'rear' | 'front' | 'uploading' | 'verifying' | 'stamped' | 'ask';

/**
 * The proof ritual: rear photo of the place, then the front camera, about a
 * second apart, both from the in-app camera. Nothing from the library.
 */
export default function Proof() {
  const { line } = useLocalSearchParams<{ line: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('rear');
  const [rearUri, setRearUri] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [ask, setAsk] = useState<AskReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofId, setProofId] = useState<string | null>(null);
  const [squad, setSquad] = useState<{ id: string; name: string; code: string } | null>(null);
  const [sportKey, setSportKey] = useState<string>('GYM');
  const card = useRef<CardRef>(null);

  useEffect(() => {
    // Authorization must precede any read; the Gold tier depends on it.
    health.available().then((ok) => ok && health.requestRead()).catch(() => {});
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from('squad_members').select('squad_id, squads(name, code)').eq('profile_id', auth.user.id).is('left_at', null).maybeSingle();
      const row = data as { squad_id: string; squads: { name: string; code: string } | { name: string; code: string }[] | null } | null;
      const one = Array.isArray(row?.squads) ? row?.squads[0] : row?.squads;
      if (row && one) setSquad({ id: row.squad_id, name: one.name, code: one.code });
      if (line) {
        const { data: l } = await supabase.from('contract_lines').select('key').eq('id', line).maybeSingle();
        if (l?.key) setSportKey(l.key);
      }
    })();
  }, [line]);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Body>Arc needs the camera for the dual-cam proof.</Body>
        <Button title="Allow camera" onPress={() => requestPermission()} />
      </View>
    );
  }

  async function shoot() {
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.6 });
      if (!shot) return;
      if (phase === 'rear') {
        setRearUri(shot.uri);
        setPhase('front');
        return;
      }
      if (phase === 'front' && rearUri) await submit(rearUri, shot.uri);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit(rear: string, front: string) {
    setPhase('uploading');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setError('Sign in first');
    const now = new Date();
    const date = localISODate(now, tz);
    const base = `${auth.user.id}/${date}/${line}`;
    const [rearPath, frontPath] = [`${base}-rear.jpg`, `${base}-front.jpg`];
    const up = async (path: string, uri: string) => {
      const bytes = await (await fetch(uri)).arrayBuffer();
      const { error: e } = await supabase.storage.from('proofs').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (e) throw e;
    };
    try {
      await Promise.all([up(rearPath, rear), up(frontPath, front)]);
      const workout = await evidenceFor(now);
      track({ name: 'proof_captured', sport: sportKey, health_evidence: !!workout });
      const { data: mark } = await supabase.from('day_marks').select('squad_id').eq('contract_line_id', line).eq('local_date', date).maybeSingle();
      const { data: proof, error: pErr } = await supabase
        .from('proofs')
        .upsert(
          {
            contract_line_id: line,
            profile_id: auth.user.id,
            squad_id: mark?.squad_id ?? squad?.id,
            local_date: date,
            day: dayOfSeason(date, SEASON_ONE),
            rear_path: rearPath,
            front_path: frontPath,
            health_workout: workout,
            status: 'pending',
          },
          { onConflict: 'contract_line_id,local_date' },
        )
        .select('id')
        .single();
      if (pErr || !proof) throw pErr ?? new Error('Could not save the proof');
      setProofId(proof.id);
      setPhase('verifying');
      const t0 = Date.now();
      const { data, error: fErr } = await supabase.functions.invoke('verify-proof', { body: { proof_id: proof.id } });
      if (fErr) throw fErr;
      if (data.status === 'verified') {
        setTier(data.tier);
        setPhase('stamped');
        track({ name: 'proof_stamped', sport: sportKey, tier: data.tier, latency_ms: Date.now() - t0 });
      } else {
        setAsk(data.reason ?? 'low_confidence');
        setPhase('ask');
        track({ name: 'proof_asked', sport: sportKey, reason: data.reason ?? 'low_confidence' });
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase('rear');
    }
  }

  const day = dayOfSeason(localISODate(new Date(), tz), SEASON_ONE);
  const copy = ask ? askCopy(ask) : null;
  const sport = SPORTS[sportKey] ?? customSport(sportKey);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={phase === 'front' ? 'front' : 'back'} />
      <View style={styles.hud}>
        <Text style={styles.hudText}>{phase === 'front' ? 'Front · you' : 'Rear · the place'}</Text>
        <Text style={styles.hudText}>Day {Math.max(0, day)}</Text>
      </View>
      {phase === 'rear' || phase === 'front' ? (
        <View style={styles.shutterWrap}>
          <Pressable onPress={shoot} style={styles.shutter} accessibilityLabel="Capture" />
          <Eyebrow>In-app camera only</Eyebrow>
        </View>
      ) : null}
      {phase === 'uploading' || phase === 'verifying' ? (
        <View style={styles.panel}>
          <Body>{phase === 'uploading' ? 'Uploading…' : 'Verifying…'}</Body>
        </View>
      ) : null}
      {phase === 'stamped' && tier ? (
        <>
          <Stamp tier={tier} subtitle={`Day ${day} / ${SEASON_ONE.arcDays} · ${tier}`} />
          <View style={{ position: 'absolute', left: -2000, top: 0 }} pointerEvents="none">
            <ProofCard
              ref={card}
              day={day}
              arcDays={SEASON_ONE.arcDays}
              time={time}
              sportWord={sport.word}
              tier={tier}
              evidence={tier === 'GOLD' ? 'Health + photo' : tier === 'SILVER' ? 'Photo' : 'Squad vouched'}
              provedToday="Proved today"
              squadName={squad?.name ?? 'My squad'}
              code={squad?.code ?? null}
            />
          </View>
          <View style={[styles.actions, { flexDirection: 'row', gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Button title="Done" variant="ghost" onPress={() => router.back()} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Share proof" onPress={() =>
                  shareCard(card, `Day ${day} of ${SEASON_ONE.arcDays} on WinArc${squad?.code ? ` · join ${squad.code}` : ''}`)
                    .then((result) => track({ name: 'proof_card_shared', result }))
                    .catch(() => track({ name: 'proof_card_shared', result: 'failed' }))
                } />
            </View>
          </View>
        </>
      ) : null}
      {phase === 'ask' && copy ? (
        <View style={styles.panel}>
          <Text style={styles.askTitle}>{copy.title}</Text>
          <Body muted>{copy.body}</Body>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="Retake" variant="ghost" onPress={() => { setAsk(null); setRearUri(null); setPhase('rear'); }} />
            </View>
            <View style={{ flex: 1.4 }}>
              <Button
                title="Ask squad to vouch"
                onPress={async () => {
                  if (!proofId) return;
                  const { error: vErr } = await supabase.rpc('request_vouch', { p_proof: proofId });
                  if (vErr) return setError(vErr.message);
                  track({ name: 'vouch_requested' });
                  router.back();
                }}
              />
            </View>
          </View>
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
  actions: { position: 'absolute', left: 20, right: 20, bottom: 30 },
  askTitle: { fontFamily: fonts.display, fontSize: 28, textTransform: 'uppercase', color: colors.ink },
});
