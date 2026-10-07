import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

import type { Product } from '@/types/models';

import { formatPrice } from './format';

export async function shareProduct(product: Product): Promise<boolean> {
  const url = Linking.createURL(`/product/${product.slug}`);
  const message = `${product.name} à ${formatPrice(product.price)} sur SHOPTV 🔥`;
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) await nav.share({ title: product.name, text: message, url });
      else await nav?.clipboard?.writeText(`${message} ${url}`);
      return true;
    }
    const result = await Share.share({ message: `${message}\n${url}`, url, title: product.name });
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}
