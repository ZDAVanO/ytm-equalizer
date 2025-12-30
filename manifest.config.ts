import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: "YTM Equalizer",
  version: pkg.version,
  description: pkg.description,
  icons: {
    16: 'public/icon-16.png',
    32: 'public/icon-32.png',
    48: 'public/icon-48.png',
    128: 'public/icon-128.png',
    256: 'public/icon-256.png',
    512: 'public/icon-512.png',
  },
  action: {
    default_icon: {
      48: 'public/icon-48.png',
    },
    default_popup: 'src/popup/index.html',
  },
  content_scripts: [{
    js: ['src/content/main.ts'],
    // "matches": [
    //     "*://music.youtube.com/*"
    // ],
    "matches": ["<all_urls>"],
    "all_frames": true,
  }],
  permissions: [
    'storage',
  ],
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },

})
