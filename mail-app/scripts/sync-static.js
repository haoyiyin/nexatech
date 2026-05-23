const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../../');
const destDir = path.join(__dirname, '../public');

const filesToSync = [
  'index.html',
  'admissions.html',
  'campus.html',
  'contact.html',
  'faculty.html',
  'news.html',
  'programs.html',
  'css/style.css',
  'js/student-login.js'
];

function sync() {
  console.log('Syncing static site assets to Next.js public directory...');
  filesToSync.forEach(file => {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);

    if (fs.existsSync(srcPath)) {
      const destSubDir = path.dirname(destPath);
      if (!fs.existsSync(destSubDir)) {
        fs.mkdirSync(destSubDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
      console.log(`  synced: ${file}`);
    } else {
      console.warn(`  missing: ${file}`);
    }
  });
  console.log('Done.');
}

sync();
