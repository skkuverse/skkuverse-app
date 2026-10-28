import { useLocalSearchParams } from 'expo-router';
import { WebBrowserScreen } from '@/features/web/browser/WebBrowserScreen';

export default function WebViewRoute() {
  const { title, url } = useLocalSearchParams<{ title?: string; url?: string }>();
  return <WebBrowserScreen title={title} url={url} />;
}
