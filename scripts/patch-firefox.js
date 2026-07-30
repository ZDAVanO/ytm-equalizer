import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve('dist');
const destDir = path.resolve('dist-firefox');

if (!fs.existsSync(srcDir)) {
  console.error('Error: dist/ directory not found. Run npm run build first.');
  process.exit(1);
}

try {
  // Copy dist to dist-firefox
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log('Copied build to dist-firefox/');

  const manifestPath = path.join(destDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Modify background for Firefox compatibility
  if (manifest.background && manifest.background.service_worker) {
    manifest.background.scripts = [manifest.background.service_worker];
    delete manifest.background.service_worker;
  }

  // Add Gecko browser specific settings with mandatory data_collection_permissions
  manifest.browser_specific_settings = {
    gecko: {
      id: "web-equalizer@oleh.ivaniuk",
      strict_min_version: "109.0",
      data_collection_permissions: {
        required: ["none"]
      }
    }
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log('Successfully patched dist-firefox/manifest.json for Firefox compatibility (including data_collection_permissions)!');
} catch (error) {
  console.error('Failed to patch manifest.json:', error);
  process.exit(1);
}
