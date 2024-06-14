const CachePool = require('./cachepool_class');

const _cachePools = new Map();

/*
使用 app.localCache.createPool(name) 來建立一個 cachePool
回傳一個 LocalCache 的 instance
*/
const createPool = (name, {
  maxSize, defaultTTL, strategy, deepCopy,
} = {}) => {
  const _pool = _cachePools.get(name);
  // 如果原本就有這個pool，覆蓋options，回傳既有的pool
  if (_pool) {
    _pool.setOptions({
      maxSize, defaultTTL, strategy, deepCopy,
    });
    return _pool;
  }

  const _instance = new CachePool({
    maxSize, defaultTTL, strategy, deepCopy,
  });
  _cachePools.set(name, _instance);

  return _instance;
};

const getPool = (name) => _cachePools.get(name);

/*
刪除一個 cachePool
需要呼叫 instance.close() 來終止cache的tick並清除所有的資料與reference
*/
const deletePool = (name) => {
  const _instance = _cachePools.get(name);
  if (_instance) {
    _instance.close();
    _cachePools.delete(name);
  }
};

module.exports = {
  createPool,
  getPool,
  deletePool,
};
