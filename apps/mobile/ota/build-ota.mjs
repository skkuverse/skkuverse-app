// The build step of an OTA publish: build the OTA bundle for one platform
// with hot-updater's own Expo build adapter, and nothing else.
//
// This is the same adapter `hot-updater deploy` would run, so the output is
// what a one-step deploy would have uploaded. This step installs the whole app
// dependency tree and so gets no secrets. Signing and upload happen in a
// separate step, outside this repository, which installs only hot-updater, the
// Cloudflare provider and the KMS client.
//
//   RELEASE_CHANNEL=<beta|production> node ota/build-ota.mjs <ios|android>
//
// Prints the build directory on the last line of stdout.
import { expo } from '@hot-updater/expo';

const platform = process.argv[2];
if (platform !== 'ios' && platform !== 'android') {
  console.error('usage: node ota/build-ota.mjs <ios|android>');
  process.exit(2);
}
// app.config.ts keys its shipping guards on this (prod API host, App Check
// debug tokens stripped); without it the bundle would be a development build.
if (process.env.RELEASE_CHANNEL !== 'beta' && process.env.RELEASE_CHANNEL !== 'production') {
  console.error('RELEASE_CHANNEL must be beta or production');
  process.exit(2);
}

const adapter = expo({ outDir: `dist-ota/${platform}`, sourcemap: false })({ cwd: process.cwd() });
const { buildPath } = await adapter.build({ platform });
console.log(buildPath);
