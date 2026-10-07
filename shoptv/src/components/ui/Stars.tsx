import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { COLORS } from '@/constants/theme';

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`Note ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={COLORS.star}
        />
      ))}
    </View>
  );
}
