'use strict';

const defaultRuntimeCaching = require('next-pwa/cache');

const apiBypassRule = {
  urlPattern: ({ url }) => {
    const isSameOrigin = self.origin === url.origin;
    if (!isSameOrigin) {
      return false;
    }

    return url.pathname.startsWith('/api/');
  },
  handler: 'NetworkOnly',
  method: 'GET',
};

module.exports = [
  apiBypassRule,
  ...defaultRuntimeCaching.filter((entry) => entry.options?.cacheName !== 'apis'),
];
