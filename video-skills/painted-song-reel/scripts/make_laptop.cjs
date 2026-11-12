// Draw the intro's laptop (laptop.html: a laptop on a dark desk, glowing keyboard, flat green screen) to a PNG.
//   node make_laptop.cjs <out.png>
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || path.join(__dirname, '..', 'assets', 'laptop.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, 'laptop.html'));
  await p.waitForFunction(() => window.ready === true);
  const url = await p.evaluate(() => window.png());
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
  console.log('laptop', out);
})();
