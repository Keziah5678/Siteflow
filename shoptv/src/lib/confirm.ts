import { Alert, Platform } from 'react-native';

/** Confirmation destructive multiplateforme (Alert natif, confirm() sur le web). */
export function confirmAction(title: string, message: string, onConfirm: () => void, confirmLabel = 'Supprimer') {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
