import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // The app imports through the `@/` alias in tsconfig. Vitest does not read
  // tsconfig paths, so the alias is repeated here. Without it every module
  // under a new directory fails to load in tests while working fine in the app.
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // Domain and provider modules are pure, so node is enough and faster than
    // a DOM environment. Component tests, if added, would need their own file.
    environment: 'node',
  },
})
