const assert = require('assert');
const Mahudas = require('mahudas');
const path = require('path');

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(() => {
    resolve();
  }, ms);
});

const app = new Mahudas({
  root: path.join(__dirname, '..'),
});

const waitForServer = () => new Promise((resolve) => {
  if (app.server) {
    resolve();
    return;
  }
  app.on('serverDidReady', resolve);
});

before(async () => {
  await waitForServer();
});

after(() => {
  app.server.close();
});

it('儲存cache', async () => {
  const _cache = app.localCache.createPool('test');
  _cache.set('a', 'aaa');

  await sleep(500);
  const _data = _cache.get('a');
  app.localCache.deletePool('test');
  assert.equal(_data, 'aaa');
});

it('測試cache過期', async () => {
  const _cache = app.localCache.createPool('test', {
    defaultTTL: 500,
  });
  _cache.set('a', 'aaa');
  _cache.set('b', 'bbb', { ttl: 1000 });

  await sleep(500);
  const _keys = _cache.keys();
  app.localCache.deletePool('test');
  assert.equal(JSON.stringify(_keys), JSON.stringify(['b']));
});

it('測試strategy=drop', async () => {
  const _cache = app.localCache.createPool('test', {
    maxSize: 2,
    strategy: 'drop',
  });
  _cache.set('a', 'aaa');
  _cache.set('b', 'bbb');
  _cache.set('c', 'ccc');
  const _keys = _cache.keys();
  assert.equal(JSON.stringify(_keys), JSON.stringify(['a', 'b']));
});

it('測試strategy=replace', async () => {
  const _cache = app.localCache.createPool('test', {
    maxSize: 2,
    strategy: 'replace',
  });
  _cache.set('a', 'aaa');
  _cache.set('b', 'bbb');
  _cache.set('c', 'ccc');
  const _keys = _cache.keys();
  assert.equal(JSON.stringify(_keys), JSON.stringify(['b', 'c']));
});
