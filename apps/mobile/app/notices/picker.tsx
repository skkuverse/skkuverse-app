import { useLocalSearchParams } from 'expo-router';
import { NoticePickerScreen } from '@/features/notices/NoticePickerScreen';

export default function NoticesPickerRoute() {
  const { tabKey } = useLocalSearchParams<{ tabKey: string }>();
  return <NoticePickerScreen tabKey={tabKey} />;
}
