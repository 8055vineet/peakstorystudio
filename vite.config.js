import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Validation rules are shared with the submit-inquiry Edge Function.
      // _shared/ is Supabase's convention for code a function depends on, so
      // pointing at it here costs nothing at deploy time and keeps one copy of
      // the rules instead of two that drift.
      '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)),
      // supabase/functions/_shared/s3-presign.js imports 'npm:aws4fetch@1.0.20'
      // — Deno's syntax for an npm package, which the Edge Function runtime
      // resolves on its own. Node has no built-in understanding of an
      // 'npm:' specifier (confirmed directly: `node --input-type=module -e
      // "import('npm:aws4fetch@1.0.20')"` throws
      // ERR_UNSUPPORTED_ESM_URL_SCHEME), so without this alias Vitest cannot
      // load that module at all and the presign tests can never run. The
      // devDependency below pins the same 1.0.20 the function imports, so
      // this alias only ever resolves to the exact code under test.
      'npm:aws4fetch@1.0.20': 'aws4fetch',
    },
  },
  build: {
    rollupOptions: {
      // Two entries, two bundles. The admin entry pulls in useSession, the
      // sign-in form, and (from Task 3 onward) the leads dashboard — none of
      // which a public visitor's browser has any reason to download. Vite/
      // Rollup code-splits each entry's own imports into its own chunk by
      // default; naming both here is what makes admin.html exist in the
      // build at all, since an unlisted HTML file is never a build input.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    // Pin the zone the suite runs in. Several assertions render a
    // timestamptz and compare the result, which is only stable if every
    // machine agrees on the local zone — otherwise the suite is green on
    // UTC CI runners and red for a developer at UTC+13 or +14, for a
    // reason that has nothing to do with their change. Timezone CORRECTNESS
    // is proved separately, by the formatDateOnly tests that deliberately
    // flip TZ across four zones.
    env: { TZ: 'UTC' },
  },
})
