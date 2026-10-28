import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

const busBanner = __DEV__
  ? Platform.select({
      android: 'ca-app-pub-3940256099942544/6300978111',
      ios: 'ca-app-pub-3940256099942544/2934735716',
    })!
  : Platform.select({
      android: 'ca-app-pub-5619947536545679/9080383017',
      ios: 'ca-app-pub-5619947536545679/2519510376',
    })!;

export const AdUnitIds = {
  busBanner,
  // WHY: borrows the bus unit, so its impressions report there, until the AdMob console has its own.
  subwayBanner: busBanner,
  webviewBanner: __DEV__
    ? Platform.select({
        android: 'ca-app-pub-3940256099942544/6300978111',
        ios: 'ca-app-pub-3940256099942544/2934735716',
      })!
    : Platform.select({
        android: 'ca-app-pub-5619947536545679/6371380570',
        ios: 'ca-app-pub-5619947536545679/8997543911',
      })!,
  // QUIRK(react-native-google-mobile-ads): adaptive banners have their own Google test unit, unlike the
  // fixed 320x50 one above, so `TestIds.ADAPTIVE_BANNER` returns variable heights as production does.
  noticeDetailBanner: __DEV__
    ? TestIds.ADAPTIVE_BANNER
    : Platform.select({
        android: 'ca-app-pub-5619947536545679/5214084608',
        ios: 'ca-app-pub-5619947536545679/1948792861',
      })!,
  gameRevive: __DEV__
    ? TestIds.REWARDED
    : Platform.select({
        android: 'ca-app-pub-5619947536545679/2637099098',
        ios: 'ca-app-pub-5619947536545679/5085410873',
      })!,
} as const;
