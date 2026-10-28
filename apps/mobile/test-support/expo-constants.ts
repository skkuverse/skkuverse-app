// expo-constants under vitest: the embedded app config the shared API module
// reads at import. The host is a placeholder; tests never reach the network.
export default {
  expoConfig: { version: '0.0.0-test', extra: { baseUrl: 'https://api.test.invalid' } },
};
