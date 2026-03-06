import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const runtimeCaching = require('../pwa/runtime-caching.cjs');

function firstMatchingRule(url, method = 'GET') {
  globalThis.self = { origin: 'https://orion.local' };

  return runtimeCaching.find((rule) => {
    if (rule.method && rule.method !== method) {
      return false;
    }

    const requestUrl = new URL(url);
    if (rule.urlPattern instanceof RegExp) {
      return rule.urlPattern.test(requestUrl.href);
    }

    if (typeof rule.urlPattern === 'function') {
      return Boolean(rule.urlPattern({ url: requestUrl }));
    }

    return false;
  });
}

describe('PWA cache isolation', () => {
  it('bypasses CacheStorage for same-origin API requests', () => {
    const apiRule = firstMatchingRule('https://orion.local/api/products');

    assert.ok(apiRule, 'expected an API runtime caching rule');
    assert.equal(apiRule.handler, 'NetworkOnly');
  });

  it('does not keep the legacy API cache bucket', () => {
    const apiCacheRule = runtimeCaching.find(
      (rule) => rule.options?.cacheName === 'apis',
    );

    assert.equal(apiCacheRule, undefined);
  });

  it('keeps non-API pages on the normal runtime strategy', () => {
    const pageRule = firstMatchingRule('https://orion.local/products');

    assert.ok(pageRule, 'expected a non-API runtime rule');
    assert.notEqual(pageRule.handler, 'NetworkOnly');
  });
});
