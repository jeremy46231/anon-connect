#!/usr/bin/env bun
import { $ } from 'bun'

const REPO_URL = 'https://github.com/simplex-chat/simplex-chat.git'
const BRANCH = 'stable'
const VENDOR_DIR = 'simplex/simplex-chat'
const PKG_PATH = 'packages/simplex-chat-client/typescript'

// Remove existing vendor directory if any
await $`rm -rf ${VENDOR_DIR}`

// Clone with partial clone + sparse checkout
await $`git clone --branch ${BRANCH} --filter=blob:none --no-checkout ${REPO_URL} ${VENDOR_DIR}`
await $`git -C ${VENDOR_DIR} sparse-checkout init --cone`
await $`git -C ${VENDOR_DIR} sparse-checkout set ${PKG_PATH}`
await $`git -C ${VENDOR_DIR} checkout`

console.log(`Cloned ${PKG_PATH} into ${VENDOR_DIR}`)

// Optionally build
if (process.env.BUILD_SIMPLEX === '1') {
  const pkgDir = `${VENDOR_DIR}/${PKG_PATH}`
  console.log(`Building in ${pkgDir}`)

  await $`bun install`.cwd(pkgDir)
  await $`bun run build`.cwd(pkgDir)

  console.log(`Built simplex-chat in ${pkgDir}`)
}
