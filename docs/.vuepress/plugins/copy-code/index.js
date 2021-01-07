"use strict";
const path = require('path');

module.exports = (options = {}) => {
  return {
    name: "copy-code",
    define: () => ({
      CODE_COPY_OPTIONS: {
        showInMobile: false,
        selector: 'div[class*="language-"] pre',
        ...options
      },
    }),
    clientRootMixin: path.resolve(__dirname, "./clientRootMixin.js"),
  };
};