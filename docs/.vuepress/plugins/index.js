const copyCode = require('./copy-code')
const pwa = require('./plugin-pwa');

module.exports = () => [
  copyCode,
  [pwa, {
    serviceWorker: true,
    updatePopup: {
      message: "New content is available.",
      buttonText: "Refresh"
    },
  }],
]