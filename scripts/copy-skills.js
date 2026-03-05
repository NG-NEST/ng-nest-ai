import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '../electron/skills');
const destDir = path.join(__dirname, '../dist/electron/skills');

function copyDir(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read directory contents
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      copyDir(srcPath, destPath);
    } else {
      // For .js files, we need to update import paths if they reference './types'
      if (entry.name.endsWith('.js')) {
        let content = fs.readFileSync(srcPath, 'utf8');
        // Replace './types' imports with the correct relative path
        // This handles cases where the built skill files still reference './types'
        content = content.replace(
          /from\s+['"]\.\/types['"]/g, 
          "from './types.js'"
        ).replace(
          /require\(['"]\.\/types['"]\)/g,
          "require('./types.js')"
        );
        fs.writeFileSync(destPath, content);
      } else {
        // Copy file as-is for non-JS files
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

try {
  console.log(`Copying skills from ${sourceDir} to ${destDir}...`);
  if (fs.existsSync(sourceDir)) {
    copyDir(sourceDir, destDir);
    console.log('Skills copied successfully.');
  } else {
    console.warn(`Source directory not found: ${sourceDir}`);
  }
} catch (error) {
  console.error('Error copying skills:', error);
  process.exit(1);
}
