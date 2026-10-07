import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { IconButton } from '@/components/ui';
import { SPACING } from '@/constants/theme';

/** Lecture vidéo dans la galerie produit (muette par défaut, en boucle). */
export function InlineVideo({ uri, onError }: { uri: string; onError: () => void }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') onError();
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  return (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <IconButton
        icon={muted ? 'volume-mute' : 'volume-high'}
        variant="round"
        size={40}
        accessibilityLabel={muted ? 'Activer le son' : 'Couper le son'}
        onPress={() => setMuted((m) => !m)}
        style={styles.mute}
      />
    </>
  );
}

const styles = StyleSheet.create({
  mute: { position: 'absolute', left: SPACING.lg, bottom: SPACING.lg },
});
