import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { SdsSpacing, t as translate, useSettingsStore } from '@skkuverse/shared';
import { ColorSchemeProvider, ResultSection, Txt, createThemedStyles } from '@skkuverse/sds';
import { recordError } from '@/platform/crashlytics';
import { checkForUpdate, reload, stageUpdate } from '@/platform/ota';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private selfHealStarted = false;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, errorInfo.componentStack);
    }
    recordError(error, errorInfo.componentStack);
    void this.selfHeal();
  }

  /**
   * QUIRK(hot-updater): the fallback counts as first content, so a bundle that throws in render is promoted
   * (hot-updater#1366, not planned); with InitGate unmounted, this is the only path a fix bundle has.
   */
  private async selfHeal() {
    if (__DEV__ || this.selfHealStarted) return;
    this.selfHealStarted = true;
    try {
      const update = await checkForUpdate();
      if (update && (await stageUpdate(update))) await reload();
    } catch {
      // WHY: never throw from the boundary; the fallback must stay usable.
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return <ErrorFallback error={__DEV__ ? this.state.error : null} onRetry={this.handleRetry} />;
  }
}

// WHY: the boundary sits above SDSProvider, so the fallback mounts its own ColorSchemeProvider to read roles.
function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <ColorSchemeProvider>
      <ErrorFallbackBody error={error} onRetry={onRetry} />
    </ColorSchemeProvider>
  );
}

function ErrorFallbackBody({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const styles = useStyles();
  const lang = useSettingsStore.getState().appLanguage;
  return (
    <View style={styles.container}>
      <ResultSection
        size="large"
        title={translate(lang, 'error.somethingWrong')}
        description={translate(lang, 'error.tryLater')}
        primaryActionProps={{ children: translate(lang, 'common.retry'), onPress: onRetry }}
      />
      {error && (
        <Txt typography="t3" color="critical" textAlign="center" style={styles.debug}>
          {error.message}
        </Txt>
      )}
    </View>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: color.bg.layerBasement,
    padding: SdsSpacing.x6,
  },
  debug: {
    marginTop: SdsSpacing.x4,
  },
}));
