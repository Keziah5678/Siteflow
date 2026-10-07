import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DropRow } from '@/components/drop/DropRow';
import { AuthPrompt } from '@/components/layout/AuthPrompt';
import { ProductTile } from '@/components/product/ProductTile';
import { AppImage, AppText, EmptyState, ListGroup, ListRow, PressableScale, Screen, Segmented, Skeleton } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useNotifications } from '@/features/account/hooks';
import { useProductsByIds } from '@/features/catalog/hooks';
import { useDrops } from '@/features/drops/hooks';
import { useDropReminder } from '@/features/drops/useDropReminder';
import { useResponsive } from '@/hooks/useResponsive';
import { formatRelative } from '@/lib/format';
import { useLibrary } from '@/store/library';
import { selectIsSignedIn, useSession } from '@/store/session';

type Tab = 'products' | 'videos' | 'drops' | 'alerts';

export default function FavoritesScreen() {
  const signedIn = useSession(selectIsSignedIn);
  const { innerWidth } = useResponsive();
  const [tab, setTab] = useState<Tab>('products');
  const favorites = useLibrary((s) => s.favorites);
  const followed = useLibrary((s) => s.followedDrops);
  const productIds = useMemo(() => favorites.filter((f) => f.kind === 'product').map((f) => f.productId), [favorites]);
  const videoIds = useMemo(() => favorites.filter((f) => f.kind === 'video').map((f) => f.productId), [favorites]);
  const products = useProductsByIds(productIds);
  const videos = useProductsByIds(videoIds);
  const drops = useDrops();
  const reminder = useDropReminder();
  const notifications = useNotifications();
  const followedDrops = (drops.data ?? []).filter((d) => followed.includes(d.id));
  const tileWidth = (innerWidth - SPACING.md) / 2;

  if (!signedIn) {
    return (
      <Screen>
        <View style={styles.header}>
          <AppText variant="h1">Favoris</AppText>
        </View>
        <View style={styles.pad}>
          <AuthPrompt title="Garde tes coups de cœur" message="Connecte-toi pour sauvegarder des produits, des vidéos et suivre les drops à venir." />
        </View>
      </Screen>
    );
  }

  const renderBody = () => {
    switch (tab) {
      case 'products':
        if (products.isLoading) return <Skeleton height={240} radius={RADIUS.md} />;
        return (products.data ?? []).length ? (
          <FlatList
            data={products.data}
            keyExtractor={(p) => p.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={{ gap: SPACING.md }}
            contentContainerStyle={{ gap: SPACING.lg }}
            renderItem={({ item }) => <ProductTile product={item} width={tileWidth} />}
          />
        ) : (
          <EmptyState icon="heart-outline" title="Aucun favori" message="Touche ♡ sur un produit pour le retrouver ici." actionLabel="Explorer" onAction={() => router.push('/explore')} />
        );
      case 'videos':
        return (videos.data ?? []).length ? (
          <View style={styles.videoGrid}>
            {(videos.data ?? []).map((p) => (
              <PressableScale
                key={p.id}
                onPress={() => router.push({ pathname: '/feed/[id]', params: { id: p.id, saved: '1' } })}
                style={[styles.video, { width: (innerWidth - SPACING.sm * 2) / 3 }]}
                accessibilityLabel={`Vidéo ${p.name}`}
              >
                <AppImage uri={p.coverUrl} style={StyleSheet.absoluteFill} />
                <View style={styles.videoPlay}>
                  <Ionicons name="play" size={14} color={COLORS.text} />
                </View>
                <AppText variant="small" numberOfLines={1} style={styles.videoName}>
                  {p.name}
                </AppText>
              </PressableScale>
            ))}
          </View>
        ) : (
          <EmptyState icon="bookmark-outline" title="Aucune vidéo sauvegardée" message="Dans le flux vidéo, touche l’icône de sauvegarde pour revoir une vidéo plus tard." />
        );
      case 'drops':
        return followedDrops.length ? (
          <View style={{ gap: SPACING.lg }}>
            {followedDrops.map((d) => (
              <DropRow key={d.id} drop={d} following onPress={() => router.push(`/drop/${d.id}`)} onToggleReminder={() => reminder.toggle(d)} />
            ))}
          </View>
        ) : (
          <EmptyState icon="notifications-outline" title="Aucun drop suivi" message="Active « Me le rappeler » sur un drop pour être prévenu." actionLabel="Voir les drops" onAction={() => router.push('/drops')} />
        );
      case 'alerts':
        return (notifications.data ?? []).length ? (
          <ListGroup>
            {(notifications.data ?? []).slice(0, 10).map((n) => (
              <ListRow key={n.id} icon={n.readAt ? 'notifications-outline' : 'notifications'} label={n.title} value={formatRelative(n.createdAt)} onPress={() => router.push('/notifications')} />
            ))}
          </ListGroup>
        ) : (
          <EmptyState icon="flash-outline" title="Aucune alerte" message="Baisses de prix, retours en stock et drops suivis apparaîtront ici." actionLabel="Réglages des notifications" onAction={() => router.push('/settings')} />
        );
    }
  };

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <AppText variant="h1">Favoris</AppText>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'products', label: 'Produits', count: productIds.length },
            { value: 'videos', label: 'Vidéos', count: videoIds.length },
            { value: 'drops', label: 'Drops', count: followed.length },
            { value: 'alerts', label: 'Alertes' },
          ]}
        />
      </Animated.View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {renderBody()}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.md, gap: SPACING.lg },
  pad: { padding: SPACING.screen },
  body: { padding: SPACING.screen, paddingBottom: SPACING.huge },
  videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  video: { aspectRatio: 9 / 14, borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: COLORS.surface, justifyContent: 'flex-end' },
  videoPlay: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.overlay },
  videoName: { padding: 6, backgroundColor: COLORS.overlay },
});
