const fs = require('fs');
const path = require('path');

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
      // Copy file
      fs.copyFileSync(srcPath, destPath);
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
