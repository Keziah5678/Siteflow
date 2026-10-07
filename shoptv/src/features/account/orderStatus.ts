import { COLORS } from '@/constants/theme';
import type { OrderStatus } from '@/types/models';

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: COLORS.warning,
  paid: COLORS.primaryBright,
  preparing: COLORS.primaryBright,
  shipped: COLORS.link,
  delivered: COLORS.success,
  cancelled: COLORS.danger,
};
