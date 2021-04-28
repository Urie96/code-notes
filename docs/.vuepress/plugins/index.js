const copyCode = require('./copy-code')
const zsh = require('./zsh')
const pwa = require('./plugin-pwa');

module.exports = () => [
  copyCode,
  zsh,
  [pwa, {
    serviceWorker: true,
    updatePopup: {
      message: "New content is available.",
      buttonText: "Refresh"
    },
  }],
  ['container', {
    type: 'row',
    before: info => `<div class="custom-block row">`,
    after: '</div>',
  }]
]