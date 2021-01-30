const path = require('path');

module.exports = ({
  serviceWorker = true,
  updatePopup = false,
  popupComponent = 'SWUpdatePopup',
}, context) => ({
  alias: {
    '@sw-event': path.resolve(__dirname, 'lib/event.js')
  },

  define() {
    const base = context.base || '/'
    return {
      SW_BASE_URL: base,
      SW_ENABLED: !!serviceWorker,
      SW_UPDATE_POPUP: updatePopup,
      SW_POPUP_COMPONENT: popupComponent
    }
  },

  globalUIComponents: updatePopup ? popupComponent : undefined,

  enhanceAppFiles: path.resolve(__dirname, 'lib/enhanceAppFile.js'),
})
