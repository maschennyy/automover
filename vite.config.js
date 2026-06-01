import { defineConfig } from 'vite'
import react    from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { fileURLToPath, URL } from 'url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),

    electron([
      // ── Main process ──────────────────────────────────────────────────────
      {
        entry: 'src/main/index.js',
        vite: {
          build: {
            outDir:    'dist-electron/main',
            sourcemap: true,
            rollupOptions: {
              external: [
                'electron', 'fs', 'path', 'os', 'url',
                'chokidar', 'electron-store', 'uuid', 'micromatch',
              ],
            },
          },
        },
      },

      // ── Preload script ────────────────────────────────────────────────────
      {
        entry: 'src/main/preload.js',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir:    'dist-electron/main',
            sourcemap: true,
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },

      // ── fileWatcher (CommonJS — required at runtime by index.js) ─────────
      {
        entry: 'src/main/fileWatcher.js',
        vite: {
          build: {
            outDir:    'dist-electron/main',
            sourcemap: true,
            lib: {
              entry:   'src/main/fileWatcher.js',
              formats: ['cjs'],
              fileName: () => 'fileWatcher.js',
            },
            rollupOptions: {
              external: [
                'electron', 'fs', 'path', 'os',
                'chokidar', 'uuid', 'micromatch',
                './fileOps',
              ],
            },
          },
        },
      },

      // ── fileOps (CommonJS — required at runtime by index.js + fileWatcher) ─
      {
        entry: 'src/main/fileOps.js',
        vite: {
          build: {
            outDir:    'dist-electron/main',
            sourcemap: true,
            lib: {
              entry:   'src/main/fileOps.js',
              formats: ['cjs'],
              fileName: () => 'fileOps.js',
            },
            rollupOptions: {
              external: [
                'electron', 'fs', 'path', 'os',
                'uuid', 'micromatch',
              ],
            },
          },
        },
      },
    ]),

    renderer(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src/renderer', import.meta.url)),
    },
  },

  // Electron renderer needs relative asset paths
  base: './',

  build: {
    outDir:     'dist',
    emptyOutDir: true,
    // Sourcemaps help with debugging in Electron DevTools
    sourcemap: true,
  },

  // Dev server settings
  server: {
    port:        5173,
    strictPort:  true,   // fail fast if port is in use
  },
})