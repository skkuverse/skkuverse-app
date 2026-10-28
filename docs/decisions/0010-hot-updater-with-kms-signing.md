---
title: hot-updater with Cloud KMS Signing for OTA
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0010. hot-updater with Cloud KMS signing for OTA from app version 3.6.2

## Status

Accepted on 2026-10-05. Supersedes [0004](0004-self-hosted-ota-fixed-runtime-version.md) for
app version 3.6.2 and later.

## Context

The expo-open-ota server chosen in [0004](0004-self-hosted-ota-fixed-runtime-version.md) signs
every manifest on request, so it holds the signing key. The replacement had to meet three
requirements:

- The OTA server serves updates, hosts the dashboard and rolls back, and never signs.
- Bundles are signed at publish time with a key that cannot leave Cloud KMS.
- The system is proven open source rather than built here.

EAS Update offers code signing only on its Production plan. Every self-hosted expo-updates server
found (expo-open-ota, Expo's reference server) signs on the server, and the CodePush servers are
archived or unmaintained. hot-updater's CLI signs each file hash at deploy time, and its 1.0 line
has Cloud KMS signing built in.

## Decision

- **Use hot-updater's 1.0 release candidate** for the client, the CLI, the Cloudflare Worker, D1
  and the console, pinned together in `apps/mobile/package.json`. A later hot-updater line gets a
  new host, a new database and a new native build rather than an in-place upgrade.
- **Remove expo-updates from the app**, because hot-updater replaces it and refuses to run
  next to it. Updates target the app `version` (`updateStrategy: "appVersion"`), which takes
  over the role of `runtimeVersion`.
- **Sign every bundle with the Cloud KMS key at publish time.** The maintainers publish from
  outside this repository, and `apps/mobile/hot-updater.config.ts` has no signer and refuses
  `deploy`.
- **Embed the KMS public key** in the binary through `@hot-updater/expo`. A bundle without a
  valid signature from it is not installed.

## Consequences

- Neither the OTA server nor this repository holds a signing secret.
- Changing the signing key needs a native release, because a binary verifies against the one
  public key it embeds.
- A release candidate is pinned. Its protocol and database may change before 1.0, so the host
  name is per generation.
- Binaries up to 3.6.0 still take updates through expo-updates under
  [0004](0004-self-hosted-ota-fixed-runtime-version.md).
- The signing and client strategy is [ota-updates.md](../explanation/ota-updates.md).
