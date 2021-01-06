"use strict";
const path = require('path');

module.exports = (options, { themeConfig }) => {
  return {
    name: "copy-code",
    define: () => ({
      CODE_COPY_OPIONS: Object.keys(options).length > 0 ? options : themeConfig.copyCode || {},
    }),
    clientRootMixin: path.resolve(__dirname, "./clientRootMixin.js"),
  };
};