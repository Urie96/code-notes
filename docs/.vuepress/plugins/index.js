const Prism = require('prismjs');
const loadLanguages = require('prismjs/components/');
const copyCode = require('./copy-code')
const zsh = require('./zsh')
const pwa = require('./plugin-pwa');

loadLanguages(['diff', 'c']);
Prism.languages.diff.comment = /(?<=(^|\n))#.*/
Prism.languages.c.string.inside = {
  placeholder: /%(d|s|hu|%)/,
  escape: /\\[\\\w]/,
}
Prism.languages.c['macro-name'] = /\b[A-Z_]+\b/

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