const fs = require('fs');
const glob = require("glob")
const brotli = require('brotli');
const chalk = require('chalk');
const zlib = require('zlib');

const pattern = './dist/**/*.{js,css,json,svg,html}'
const threshold = 1024 * 5

glob(pattern, (err, files) => {
  files.forEach((file) => {
    fs.readFile(file, (err, src) => {
      if (src.length > threshold) {
        const brFileName = file + '.br'
        const gzFileName = file + '.gz'
        const brzip = brotli.compress(src, { mode: 1 })
        const gzip = zlib.gzipSync(src)
        printProfitInfo(brFileName, src.length, brzip.length)
        printProfitInfo(gzFileName, src.length, gzip.length)
        fs.writeFile(brFileName, brzip, () => { })
        fs.writeFile(gzFileName, gzip, () => { })
      }
    })
  })
})

function printProfitInfo(filePath, inBytes, outBytes) {
  var profitPercents = 100 - (outBytes * 100) / inBytes;
  console.log(
    chalk.blue(filePath) +
    ' : ' +
    Math.round((inBytes / 1024) * 1000) / 1000 +
    ' KiB' +
    (profitPercents < 0 ? ' + ' : ' - ') +
    chalk.green(Math.abs(Math.round(profitPercents * 10) / 10) + '%') +
    ' = ' +
    Math.round((outBytes / 1024) * 1000) / 1000 +
    ' KiB'
  );
}