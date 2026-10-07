import { router } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState icon="planet-outline" title="Page introuvable" message="Ce contenu n’existe pas ou a été déplacé." actionLabel="Retour à l’accueil" onAction={() => router.replace('/home')} />
    </Screen>
  );
}
