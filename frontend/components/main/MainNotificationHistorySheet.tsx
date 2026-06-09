import Feather from '@expo/vector-icons/Feather';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ApiRequestError,
  fetchNotificationHistory,
  markAllNotificationsRead,
  SessionExpiredError,
} from '../../lib/api-client';
import type { NotificationHistoryItemDto } from '../../lib/types/api';
import { glassCardStyle, spacing } from '../../themes/design-tokens';
import { useTheme } from '../../themes/ThemeContext';

const HISTORY_PAGE_SIZE = 20;

interface MainNotificationHistorySheetProps {
  visible: boolean;
  onClose: () => void;
  onSessionInvalidated: () => void | Promise<void>;
  onReadStateChanged?: () => void;
}

function formatHistoryWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return '방금 전';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}분 전`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}시간 전`;
  return d.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MainNotificationHistorySheet({
  visible,
  onClose,
  onSessionInvalidated,
  onReadStateChanged,
}: MainNotificationHistorySheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationHistoryItemDto[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const markedReadRef = useRef(false);

  const handleError = useCallback(
    async (e: unknown) => {
      if (e instanceof SessionExpiredError) {
        await onSessionInvalidated();
        return;
      }
      setError(
        e instanceof ApiRequestError ? e.message : '알림 내역을 불러오지 못했습니다.',
      );
    },
    [onSessionInvalidated],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    setHasMore(false);
    markedReadRef.current = false;
    try {
      const data = await fetchNotificationHistory({ limit: HISTORY_PAGE_SIZE });
      setItems(data.items);
      setHasMore(data.hasMore);
      if (data.unreadCount > 0 && !markedReadRef.current) {
        await markAllNotificationsRead();
        markedReadRef.current = true;
        onReadStateChanged?.();
      }
    } catch (e) {
      await handleError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [handleError, onReadStateChanged]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || items.length === 0) return;
    const last = items[items.length - 1];
    if (!last?.createdAt) return;

    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchNotificationHistory({
        limit: HISTORY_PAGE_SIZE,
        before: last.createdAt,
      });
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const next = data.items.filter((i) => !seen.has(i.id));
        return [...prev, ...next];
      });
      setHasMore(data.hasMore);
    } catch (e) {
      await handleError(e);
    } finally {
      setLoadingMore(false);
    }
  }, [handleError, hasMore, items, loading, loadingMore]);

  useEffect(() => {
    if (visible) void loadInitial();
  }, [visible, loadInitial]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="닫기"
        />
        <View
          style={[
            styles.sheet,
            glassCardStyle(theme),
            {
              marginTop: Math.max(insets.top, 12) + 48,
              maxHeight: '72%',
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Feather name="bell" size={18} color={theme.primaryGlow} />
              <Text style={[styles.title, { color: theme.foreground }]}>
                알림 내역
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="닫기">
              <Feather name="x" size={20} color={theme.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.lead, { color: theme.mutedForeground }]}>
            받은 푸시 알림을 확인할 수 있어요.
          </Text>

          {loading ? (
            <ActivityIndicator color={theme.primaryGlow} style={{ marginVertical: 32 }} />
          ) : error && items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={[styles.err, { color: theme.destructive }]}>{error}</Text>
              <Pressable onPress={() => void loadInitial()}>
                <Text style={{ color: theme.primaryGlow, fontSize: 13 }}>다시 불러오기</Text>
              </Pressable>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="inbox" size={28} color={theme.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
                아직 받은 알림이 없어요
              </Text>
              <Text style={[styles.emptySub, { color: theme.mutedForeground }]}>
                Star-Index 알림을 켜 두면 여기에 기록됩니다.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                const nearBottom =
                  layoutMeasurement.height + contentOffset.y >= contentSize.height - 48;
                if (nearBottom) void loadMore();
              }}
              scrollEventThrottle={200}
            >
              {items.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.item,
                    {
                      borderColor: theme.borderSubtle,
                      backgroundColor: theme.inputBackground,
                    },
                  ]}
                >
                  <View style={styles.itemTop}>
                    <Text
                      style={[styles.itemTitle, { color: theme.foreground }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.itemWhen, { color: theme.mutedForeground }]}>
                      {formatHistoryWhen(item.createdAt)}
                    </Text>
                  </View>
                  <Text style={[styles.itemBody, { color: theme.mutedForeground }]}>
                    {item.body}
                  </Text>
                </View>
              ))}
              {hasMore ? (
                <View style={styles.moreWrap}>
                  {loadingMore ? (
                    <ActivityIndicator color={theme.primaryGlow} size="small" />
                  ) : (
                    <Pressable onPress={() => void loadMore()} hitSlop={8}>
                      <Text style={[styles.moreBtn, { color: theme.primaryGlow }]}>
                        더 보기
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
              {error ? (
                <Text style={[styles.err, { color: theme.destructive, textAlign: 'center' }]}>
                  {error}
                </Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    padding: spacing.lg,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: '600' },
  lead: { fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  listScroll: { flexGrow: 0 },
  listContent: { gap: 10, paddingBottom: spacing.sm },
  item: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: 6,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  itemWhen: { fontSize: 11 },
  itemBody: { fontSize: 13, lineHeight: 18 },
  moreWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  moreBtn: { fontSize: 13, fontWeight: '600' },
  emptyWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: spacing.md,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  err: { fontSize: 13, textAlign: 'center' },
});
