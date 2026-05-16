import test from 'node:test';
import assert from 'node:assert/strict';
import { FigmaAPIClient } from '../chrome-extension/lib/figma-api-client';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  });
}

test('FigmaAPIClient fetches rendered image URLs for a node', async () => {
  const calls: Array<{ url: string; token: string | null }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: input.toString(),
      token: headers.get('X-Figma-Token')
    });
    return jsonResponse({
      images: {
        '12:34': 'https://figma-images.example/node.png'
      }
    });
  };

  try {
    const client = new FigmaAPIClient('figd_test_token');
    const result = await client.getImage('12:34', 'file_key');

    assert.deepEqual(result, { imageUrl: 'https://figma-images.example/node.png' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.figma.com/v1/images/file_key?ids=12%3A34&format=png&scale=2');
    assert.equal(calls[0].token, 'figd_test_token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient falls back to the first returned image key', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => jsonResponse({
    images: {
      'resolved-key': 'https://figma-images.example/fallback.png'
    }
  });

  try {
    const client = new FigmaAPIClient('figd_test_token');
    const result = await client.getImage('12:34', 'file_key');

    assert.deepEqual(result, { imageUrl: 'https://figma-images.example/fallback.png' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient reports missing rendered image URLs', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => jsonResponse({ images: {} });

  try {
    const client = new FigmaAPIClient('figd_test_token');

    await assert.rejects(
      () => client.getImage('12:34', 'file_key'),
      /Image render not available for this node/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient reports absent rendered image responses', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => jsonResponse({});

  try {
    const client = new FigmaAPIClient('figd_test_token');

    await assert.rejects(
      () => client.getImage('12:34', 'file_key'),
      /Image render not available for this node/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient connects by requesting the current user', async () => {
  const calls: Array<{ url: string; token: string | null }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: input.toString(),
      token: headers.get('X-Figma-Token')
    });
    return jsonResponse({ id: 'user-id' });
  };

  try {
    const client = new FigmaAPIClient('figd_test_token');

    await client.connect();

    assert.deepEqual(calls, [{
      url: 'https://api.figma.com/v1/me',
      token: 'figd_test_token'
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient fetches node documents by exact id', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    assert.equal(input.toString(), 'https://api.figma.com/v1/files/file_key/nodes?ids=12%3A34');
    return jsonResponse({
      nodes: {
        '12:34': {
          document: {
            id: '12:34',
            name: 'Primary frame'
          }
        }
      }
    });
  };

  try {
    const client = new FigmaAPIClient('figd_test_token');
    const node = await client.getNode('12:34', 'file_key');

    assert.deepEqual(node, {
      id: '12:34',
      name: 'Primary frame'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient falls back to the first returned node key', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => jsonResponse({
    nodes: {
      'resolved-key': {
        document: {
          id: 'resolved-key',
          name: 'Resolved frame'
        }
      }
    }
  });

  try {
    const client = new FigmaAPIClient('figd_test_token');
    const node = await client.getNode('12:34', 'file_key');

    assert.deepEqual(node, {
      id: 'resolved-key',
      name: 'Resolved frame'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient fetches component lists from a file', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    assert.equal(input.toString(), 'https://api.figma.com/v1/files/file_key/components');
    return jsonResponse({
      meta: {
        components: [
          { node_id: '1:1', name: 'Button' },
          { node_id: '1:2', name: 'Header' }
        ]
      }
    });
  };

  try {
    const client = new FigmaAPIClient('figd_test_token');
    const components = await client.getComponents('file_key');

    assert.deepEqual(components, [
      { node_id: '1:1', name: 'Button' },
      { node_id: '1:2', name: 'Header' }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient reports missing node documents', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => jsonResponse({
    nodes: {
      '12:34': {}
    }
  });

  try {
    const client = new FigmaAPIClient('figd_test_token');

    await assert.rejects(
      () => client.getNode('12:34', 'file_key'),
      /Node not found in Figma file/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient reports missing node responses', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => jsonResponse({});

  try {
    const client = new FigmaAPIClient('figd_test_token');

    await assert.rejects(
      () => client.getNode('12:34', 'file_key'),
      /Node not found in Figma file/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient reports empty node responses', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => jsonResponse({ nodes: {} });

  try {
    const client = new FigmaAPIClient('figd_test_token');

    await assert.rejects(
      () => client.getNode('12:34', 'file_key'),
      /Node not found in Figma file/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient includes API error response bodies', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response('Invalid token', {
    status: 403,
    statusText: 'Forbidden'
  });

  try {
    const client = new FigmaAPIClient('figd_test_token');

    await assert.rejects(
      () => client.connect(),
      /Figma API 403: Invalid token/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient falls back to status text when API error body is unavailable', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Server Error',
    text: async () => {
      throw new Error('body unavailable');
    }
  } as Response);

  try {
    const client = new FigmaAPIClient('figd_test_token');

    await assert.rejects(
      () => client.connect(),
      /Figma API 500: Server Error/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FigmaAPIClient falls back to status text when API error body is empty', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response('', {
    status: 404,
    statusText: 'Not Found'
  });

  try {
    const client = new FigmaAPIClient('figd_test_token');

    await assert.rejects(
      () => client.connect(),
      /Figma API 404: Not Found/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
