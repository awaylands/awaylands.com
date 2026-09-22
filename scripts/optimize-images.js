const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sourceDirectory = path.join(root, 'src/images');
const destinationDirectory = path.join(root, 'build/assets/images');

fs.mkdirSync(destinationDirectory, {recursive: true});

async function optimizeImage(name) {
  const source = path.join(sourceDirectory, name);
  const destination = path.join(destinationDirectory, name);
  const extension = path.extname(name).toLowerCase();
  const image = sharp(source, {failOn: 'warning'}).rotate();

  if (extension === '.png') {
    await image.png({adaptiveFiltering: true, compressionLevel: 9}).toFile(destination);
    return;
  }

  if (extension === '.jpg' || extension === '.jpeg') {
    await image.jpeg({mozjpeg: true, quality: 88}).toFile(destination);
    return;
  }

  fs.copyFileSync(source, destination);
}

Promise.all(fs.readdirSync(sourceDirectory).map(optimizeImage))
  .then(() => process.stdout.write(`${fs.readdirSync(sourceDirectory).length} images optimized\n`))
  .catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
