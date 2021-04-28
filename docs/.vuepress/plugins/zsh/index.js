const path = require('path');
const Prism = require('prismjs');
const loadLanguages = require('prismjs/components/');

loadLanguages(['bash']);
const { string, comment, operator } = Prism.languages.bash

Prism.hooks.add('wrap', (env) => {
  if (env.type === 'root') {
    env.content = '❯';
  }
});

Prism.languages.zsh = {
  signal: { pattern: /\n\^[CZ]\n/ },
  function: { pattern: /(?<=((\$|;|\||&&)[ (]*))[./\w_-]+/ },
  parameter: { pattern: /(?<= )-\w+/ },
  root: { pattern: /(?<=(^|\n))\$(?=\W)/ },
  string, comment, operator,
}

module.exports = () => ({
  name: 'zsh',
  clientRootMixin: path.resolve(__dirname, "./clientRootMixin.js"),
})
