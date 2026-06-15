import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../../themes/ThemeContext';
import { getKakaoRedirectUri, getKakaoRestApiKey } from '../../../lib/config';

interface KakaoLoginWebViewModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (code: string, redirectUri: string) => void;
  onFailure: (error: Error) => void;
}

export function KakaoLoginWebViewModal({
  visible,
  onClose,
  onSuccess,
  onFailure,
}: KakaoLoginWebViewModalProps) {
  const { theme } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const clientId = getKakaoRestApiKey();
  const redirectUri = getKakaoRedirectUri();

  if (!clientId) {
    return null;
  }

  const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code`;

  const handleNavigationStateChange = (navState: any) => {
    const { url } = navState;
    if (url.startsWith(redirectUri)) {
      // 리다이렉트 포착 후 WebView 로딩 중지
      webViewRef.current?.stopLoading();

      const match = url.match(/[?&]code=([^&]+)/);
      if (match && match[1]) {
        onSuccess(match[1], redirectUri);
      } else {
        const errorMatch = url.match(/[?&]error=([^&]+)/);
        if (errorMatch) {
          onFailure(new Error(`카카오 로그인 실패: ${errorMatch[1]}`));
        } else {
          onFailure(new Error('인증 코드를 가져오지 못했습니다.'));
        }
      }
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={[styles.closeText, { color: theme.foreground }]}>✕</Text>
          </Pressable>
          <Text style={[styles.title, { color: theme.foreground }]}>카카오 로그인</Text>
          <View style={styles.placeholder} />
        </View>

        <WebView
          ref={webViewRef}
          source={{ uri: authUrl }}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={(request) => {
            const { url } = request;
            // 카카오톡 앱 전환 스킴 또는 기타 외부 앱 스킴 허용 및 처리
            if (!url.startsWith('http://') && !url.startsWith('https://') && url !== 'about:blank') {
              if (url.startsWith('kakaotalk://')) {
                return false; // 카카오톡 앱 이동을 조용히 차단하고 웹뷰 화면 유지
              }

              Linking.openURL(url).catch((err) => {
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.warn('[KakaoLoginWebViewModal] 외부 앱 열기 실패', err);
                }
              });
              return false; // WebView 자체 로딩은 차단
            }
            return true;
          }}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={[styles.loadingWrap, { backgroundColor: theme.background }]}>
              <ActivityIndicator size="large" color={theme.primaryGlow} />
            </View>
          )}
          style={styles.webview}
          // Kakao Login page has some issues with certain user-agents on Android
          userAgent={
            Platform.OS === 'android'
              ? 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
              : undefined
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 20,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  webview: {
    flex: 1,
  },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
