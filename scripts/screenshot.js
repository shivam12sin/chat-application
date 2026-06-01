const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  try {
    const outDir = path.resolve(__dirname);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const url = process.argv[2] || 'http://localhost';
    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // small delay to let dynamic UI render
    await new Promise(r => setTimeout(r, 1000));
    const outPath = path.join(outDir, 'screenshot.png');
    await page.screenshot({ path: outPath, fullPage: true });
    console.log('Saved screenshot to', outPath);
    await browser.close();
  } catch (err) {
    console.error('Screenshot failed:', err);
    process.exit(1);
  }
})();
