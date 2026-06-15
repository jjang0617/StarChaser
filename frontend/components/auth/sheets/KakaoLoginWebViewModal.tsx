import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
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

  // 카카오톡 앱 직접 연동 로그인 버튼 및 불필요한 가이드 텍스트를 DOM에서 찾아 숨김 처리하고 여백 및 인풋 크기를 조절하는 CSS 주입
  const injectedJs = `
    (function() {
      // 중복 초기화 및 setInterval 생성 방지 가드
      if (window.scInitialized) return;
      window.scInitialized = true;

      // 1. 여백 제거 및 인풋/버튼 확대용 CSS 주입
      const injectStyles = () => {
        try {
          if (document.getElementById('sc-injected-style')) return;
          const style = document.createElement('style');
          style.id = 'sc-injected-style';
          style.textContent = \`
            /* 인풋 필드 크기 및 글꼴 확대 */
            input[type="text"], input[type="email"], input[type="password"], input[type="tel"], .tf_g, .tf_cc {
              font-size: 18px !important;
              height: 54px !important;
              padding: 10px 16px !important;
              box-sizing: border-box !important;
            }
            /* 로그인 버튼 크기 확대 */
            button[type="submit"], .btn_g.btn_confirm {
              font-size: 18px !important;
              height: 54px !important;
              box-sizing: border-box !important;
            }
            /* 컨테이너 흰색 여백 축소 */
            body, html {
              padding: 0 !important;
              margin: 0 !important;
            }
            /* 모든 레이아웃 박스의 가로 고정크기 제한 해제 및 화면 꽉 차게 확장 */
            div, section, main {
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            /* 로그인 컨테이너 패딩 최소화 및 꽉 차게 확장 */
            .cont_login, .inner_login, .card_login, main, [class*="cont_"], [class*="inner_"], [class*="card_"] {
              padding-left: 16px !important;
              padding-right: 16px !important;
              padding-top: 4px !important;
              padding-bottom: 4px !important;
              margin: 0 auto !important;
              width: 100% !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            /* 로고 및 헤더 영역 정가운데 정렬 및 마진 조정 */
            h1, [class*="logo"], [class*="tit_"] {
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              text-align: center !important;
              margin-left: auto !important;
              margin-right: auto !important;
              margin-top: 24px !important;
              margin-bottom: 16px !important;
              padding-top: 0 !important;
              padding-bottom: 0 !important;
              width: 100% !important;
            }
            h1 a, [class*="logo"] a, [class*="tit_"] a {
              display: flex !important;
              justify-content: center !important;
              align-items: center !important;
              margin: 0 auto !important;
              text-align: center !important;
              width: auto !important;
            }
            h1 img, [class*="logo"] img, [class*="tit_"] img {
              margin: 0 auto !important;
              display: block !important;
            }
            /* 기타 간격 미세 조정 */
            .box_tf, [class*="box_tf"], [class*="item_ip"] {
              margin-bottom: 12px !important;
            }
          \`;
          document.head.appendChild(style);
        } catch (e) {
          console.error('Style injection error:', e);
        }
      };

      const hideTalkBtn = () => {
        try {
          injectStyles();

          // 2. 클래스 및 속성 선택자로 카카오톡 직접 연결 요소를 감지하여 숨김
          const selectors = [
            '.btn_talk',
            'a[href*="kakaotalk"]',
            'a[href*="talk-login"]',
            '.link_talk',
            '.btn_login[href*="talk"]'
          ];
          selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
              if (el && el.style && el.style.display !== 'none') {
                el.style.setProperty('display', 'none', 'important');
              }
            });
          });

          // 3. 텍스트 매칭으로 카카오톡 로그인 유도 버튼 및 불필요한 가이드 텍스트 숨김 (div 컨테이너는 절대 건드리지 않음)
          const els = document.querySelectorAll('*');
          els.forEach(el => {
            if (el && el.textContent) {
              const text = el.textContent.trim();
              
              // (1) 카카오톡으로 로그인 버튼 감지 (a, button 또는 그 안의 텍스트 요소)
              if (text.includes('카카오톡') && text.includes('로그인')) {
                const btn = el.closest('a') || el.closest('button');
                if (btn) {
                  if (btn.style && btn.style.display !== 'none') {
                    btn.style.setProperty('display', 'none', 'important');
                  }
                  
                  // 상위 3단계 래퍼 중 input/form이 없는 래퍼들 모두 축소 및 숨김 (여백 완전 제거)
                  let current = btn;
                  for (let i = 0; i < 3; i++) {
                    if (current.parentElement) {
                      const parent = current.parentElement;
                      if (parent.querySelector('input, form') === null) {
                        parent.style.setProperty('display', 'none', 'important');
                        parent.style.setProperty('height', '0', 'important');
                        parent.style.setProperty('margin', '0', 'important');
                        parent.style.setProperty('padding', '0', 'important');
                        current = parent;
                      } else {
                        break;
                      }
                    } else {
                      break;
                    }
                  }
                } else if (el.children.length === 0) {
                  // 잎 노드(텍스트 요소)일 때만 안전하게 숨김
                  if (el.style && el.style.display !== 'none') {
                    el.style.setProperty('display', 'none', 'important');
                  }
                }
              }
              
              // (2) 가이드 문구 감지 및 숨김
              if (
                text === '또는' ||
                text === 'or' ||
                text.includes('계정과 비밀번호 입력 없이') ||
                text.includes('로그인할 수 있어요') ||
                text.includes('로그인 할 수 있어요') ||
                text.includes('간편하게 로그인') ||
                text.includes('계정 정보 입력으로도')
              ) {
                // 부모/자식 관계에 input, form, button, a가 전혀 포함되지 않은 텍스트 컨테이너만 안전하게 숨김
                if (el.querySelector('input, form, button, a') === null) {
                  if (el.style && el.style.display !== 'none') {
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('height', '0', 'important');
                    el.style.setProperty('margin', '0', 'important');
                    el.style.setProperty('padding', '0', 'important');
                  }
                }
              }
            }
          });
        } catch (e) {
          console.error(e);
        }
      };
      
      hideTalkBtn();
      setInterval(hideTalkBtn, 100); // 동적 렌더링 대응
    })();
    true;
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: Platform.OS === 'android' ? insets.top : 0,
          },
        ]}
      >
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
          injectedJavaScript={injectedJs}
          onLoadEnd={() => {
            webViewRef.current?.injectJavaScript(injectedJs);
          }}
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
      </View>
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
