import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

let commitHash = 'dev';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('Failed to retrieve git commit hash:', e);
}

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __BUILD_VERSION__: JSON.stringify('1.2.0'),
    __COMMIT_HASH__: JSON.stringify(commitHash)
  }
});
