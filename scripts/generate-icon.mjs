// 将 src/assets/logo/icon_black.svg 转为 resources/icon.png
// 用于 Electron BrowserWindow 的 window icon
// 运行方式: node scripts/generate-icon.mjs
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const svgPath = resolve(projectRoot, 'src/assets/logo/icon_black.svg');
const outDir = resolve(projectRoot, 'resources');
const outPath = resolve(outDir, 'icon.png');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const svgBuffer = readFileSync(svgPath);

// 生成 1024x1024 PNG（覆盖 Windows/macOS/Linux 全平台图标需求）
// electron-builder 会自动从该 PNG 生成 .ico (Windows) 和 .icns (macOS)
await sharp(svgBuffer)
  .resize(1024, 1024)
  .png()
  .toFile(outPath);

console.log(`✓ Generated: ${outPath} (1024x1024)`);
