/// <reference types="node" />
import { existsSync } from 'node:fs';
import { d1Database, plugins, r2Storage } from '@hot-updater/cloudflare';
import { expo } from '@hot-updater/expo';
import { defineConfig } from 'hot-updater';

// QUIRK(hot-updater): the CLI loads this file in its own process with no global options, so the
// command is argv[2]; Expo (prebuild, `expo config`) loads it with its own argv.
const [, cliEntry = '', cliCommand] = process.argv;
// WHY: bundles are signed only with the Cloud KMS key whose public half the app embeds, and this
// config has no `signing`, so it refuses `deploy` before anything is built or uploaded.
if (/[\\/]hot-updater(?:[\\/]|$)/.test(cliEntry) && cliCommand === 'deploy') {
  throw new Error(
    'hot-updater deploy is disabled in apps/mobile. OTA updates are published only by the ' +
      "maintainers' publish tooling, outside this repository. This config has no signer, because " +
      'bundles are signed only there with the Cloud KMS key, so a deploy from here would upload ' +
      'an unsigned bundle that every device rejects.',
  );
}

if (existsSync('.env.hotupdater')) process.loadEnvFile('.env.hotupdater');

// WHY: prebuild needs no Cloudflare values, so a missing one reads as empty; the Cloudflare API
// rejects any command that reaches D1 or R2 without them.
const env = (name: string): string => process.env[name] ?? '';

export default defineConfig({
  build: expo(),
  storage: r2Storage({
    accountId: env('HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID'),
    bucketName: env('HOT_UPDATER_CLOUDFLARE_R2_BUCKET_NAME'),
    credentials: {
      accessKeyId: env('HOT_UPDATER_CLOUDFLARE_R2_ACCESS_KEY_ID'),
      secretAccessKey: env('HOT_UPDATER_CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
    },
  }),
  database: d1Database({
    accountId: env('HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID'),
    databaseId: env('HOT_UPDATER_CLOUDFLARE_D1_DATABASE_ID'),
    cloudflareApiToken: env('HOT_UPDATER_CLOUDFLARE_API_TOKEN'),
  }),
  plugins,
  updateStrategy: 'appVersion',
});
