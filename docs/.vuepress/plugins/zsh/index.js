const path = require('path');
const Prism = require('prismjs');
const loadLanguages = require('prismjs/components/');

loadLanguages(['bash']);
const { string, comment, operator, number } = Prism.languages.bash

Prism.hooks.add('wrap', (env) => {
  if (env.type === 'root') {
    env.content = '❯';
  }
});

Prism.languages.zsh = {
  cmd: {
    pattern: /(?<=(^|\n))\$( .*|\n)/,
    inside: {
      function: /(?<=((\n\$|^\$|;|\||&&)[ (]*))[./\w_-]+/,
      parameter: /(?<= )-{1,2}\w+/,
      string,
      operator,
      number,
      comment,
      root: /^\$/, // 最后面，因为被替换了
    }
  },
  signal: { pattern: /\n\^[CZ]\n/ },
  comment,
}

module.exports = () => ({
  name: 'zsh',
  clientRootMixin: path.resolve(__dirname, "./clientRootMixin.js"),
})
