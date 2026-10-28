// WHY: RELEASE-GATE(debug-menu); remove this screen and its entry row before an App Store release.
// The screen shows the FCM token, so it is for the owner's own device only; the devLog buffer never holds it.
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { readRawDeviceToken } from '@/platform/messaging';
import {
  clearDevLogs,
  formatLogsForShare,
  getDevLogs,
} from '@/platform/dev-log';
import { shareContent } from '@/platform/handoff';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, createThemedStyles, Txt } from '@skkuverse/sds';

export function DebugLogsScreen() {
  const styles = useStyles();
  const [logs, setLogs] = useState<string>(() => formatLogsForShare());
  const [token, setToken] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLogs(formatLogsForShare());
  }, []);

  useEffect(() => {
    let cancelled = false;
    readRawDeviceToken()
      .then((t) => {
        if (!cancelled) setToken(t ?? null);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entryCount = getDevLogs().length;

  const handleShare = useCallback(async () => {
    try {
      await shareContent({
        message: logs,
        title: 'SKKUverse Debug Logs',
      });
    } catch (e) {
      Alert.alert('공유 실패', String(e));
    }
  }, [logs]);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(logs);
    Alert.alert('복사됨', `${entryCount}개 항목`);
  }, [logs, entryCount]);

  const handleCopyToken = useCallback(async () => {
    if (!token) return;
    await Clipboard.setStringAsync(token);
    Alert.alert('FCM 토큰 복사됨');
  }, [token]);

  const handleClear = useCallback(() => {
    Alert.alert('로그 삭제', '저장된 디버그 로그를 모두 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          clearDevLogs();
          refresh();
        },
      },
    ]);
  }, [refresh]);

  return (
    <View style={styles.container}>
      <View style={styles.tokenBox}>
        <Txt typography="t1" fontWeight="semibold" style={styles.tokenLabel}>FCM Token</Txt>
        <Pressable feedback="none" onLongPress={handleCopyToken}>
          <Text style={styles.tokenValue} selectable numberOfLines={3}>
            {token ?? '(loading…)'}
          </Text>
        </Pressable>
        <Text style={styles.hint}>길게 눌러 복사 — Firebase Console에 붙여넣기 가능</Text>
      </View>

      <View style={styles.toolbar}>
        <Pressable bg="neutralWeak" style={styles.btn} onPress={handleShare}>
          <Txt typography="t3" fontWeight="medium" style={styles.btnText}>공유</Txt>
        </Pressable>
        <Pressable bg="neutralWeak" style={styles.btn} onPress={handleCopy}>
          <Txt typography="t3" fontWeight="medium" style={styles.btnText}>복사</Txt>
        </Pressable>
        <Pressable bg="neutralWeak" style={styles.btn} onPress={refresh}>
          <Txt typography="t3" fontWeight="medium" style={styles.btnText}>새로고침</Txt>
        </Pressable>
        <Pressable bg="criticalWeak" style={styles.btn} onPress={handleClear}>
          <Txt typography="t3" fontWeight="medium" style={[styles.btnText, styles.btnTextDanger]}>삭제</Txt>
        </Pressable>
      </View>

      <Txt typography="t1" style={styles.meta}>{entryCount}개 항목</Txt>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.logText} selectable>
          {logs || '(로그 없음)'}
        </Text>
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    backgroundColor: color.bg.layerDefault,
  },
  tokenBox: {
    padding: SdsSpacing.x3,
    backgroundColor: color.bg.neutralWeak,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  tokenLabel: {
    color: '#444',
    marginBottom: SdsSpacing.x1,
  },
  tokenValue: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: '#222',
  },
  hint: {
    fontSize: 9,
    color: '#888',
    marginTop: SdsSpacing.x1,
  },
  toolbar: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
    padding: SdsSpacing.x3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  btn: {
    paddingVertical: SdsSpacing.x2,
    paddingHorizontal: SdsSpacing.x3,
    borderRadius: SdsRadius.r1_5,
  },
  btnText: {
    color: '#222',
  },
  btnTextDanger: {
    color: '#C33',
  },
  meta: {
    paddingHorizontal: SdsSpacing.x3,
    paddingTop: SdsSpacing.x2,
    color: '#888',
  },
  scrollContent: {
    padding: SdsSpacing.x3,
    paddingBottom: SdsSpacing.x12,
  },
  logText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: '#222',
    lineHeight: 14,
  },
}));
