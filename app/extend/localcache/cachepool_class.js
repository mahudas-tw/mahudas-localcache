const { EventEmitter } = require('events');

/*
處理local cache機制的類別

基本上是Map()的延伸，只是加入了過期時間的判斷。
為了避免一直不斷的setInterval造成系統資源的浪費，
因此 LocalCache 的設計並不是用一個timer每秒鐘掃描cache資料，
而是在必要時才去計算下次要掃描的時間點。

過期資料掃描的時間點計算方式是依照:
1. 每當有資料進來時，計算它即將過期的時間，並設定一個setTimeout在目標時間觸發
2. setTimeout觸發時，呼叫_onTick清除已過期資料，並重新計算下一次的tick時間
3. 當cache資料都已經沒有(或是剩下的都是永久資料時)，setTimeout就會停止
4. 只要有新的資料進入，都會重新跑一次1-3的流程
*/
class CachePool extends EventEmitter {
  /* eslint-disable lines-between-class-members */
  app = global.app;
  maxSize = 0; // 最多可儲存的數量，0表示不限制
  defaultTTL = 0; // 預設的過期時間(ms)，0表示不會過期
  strategy; // 當maxSize滿了時如果再加入資料時的策略
  deepCopy = true; // 設定傳入與傳出時是否要進行deepCopy
  _availableStrategies = [
    'replace', // 把最舊的資料移除(依照set的順序決定)
    'drop', // 拋棄要插入的資料
  ];
  _nextExpiredAt; // 用來記錄下一個準備要過期的時間
  _timer; // setTimeout的timer
  _cacheMap = new Map();
  /* eslint-enable lines-between-class-members */

  constructor(options) {
    super();
    this.setOptions(options);
  }

  setOptions({
    maxSize = 0,
    defaultTTL = 0,
    strategy = 'replace',
    deepCopy = true,
  } = {}) {
    const { to } = this.app.utils;
    this.maxSize = to.number(maxSize) || 0;
    this.defaultTTL = to.number(defaultTTL) || 0;
    this.strategy = to.string(strategy).toLowerCase();
    if (!this._availableStrategies.includes(this.strategy)) {
      this.strategy = 'replace';
    }
    this.deepCopy = to.boolean(deepCopy);
  }

  // setTimeout 被觸發時會呼叫 _onTick
  // _onTick會清除過期資料
  _onTick() {
    clearTimeout(this._timer);

    const _now = Date.now();
    let nextTickMs = 0;
    // 掃描_cacheMap，將過期的物件移除
    // 並計算最靠近現在的下一筆即將過期的資料距離現在的時間點
    this._cacheMap.forEach((data, key) => {
      if (data.expiredAt) {
        if (data.expiredAt <= _now) {
          this.emit('expired', key, data.value);
          this._cacheMap.delete(key);
        } else {
          const _interval = data.expiredAt - _now;
          if (nextTickMs === 0
          || (nextTickMs > 0 && nextTickMs > _interval)) {
            nextTickMs = _interval;
          }
        }
      }
    });

    // 清除_nextExpiredAt，呼叫_updateNextExpired重新計算下次的tick時間
    this._nextExpiredAt = null;
    this._updateNextExpired(nextTickMs);
  }

  // 比對_nextExpiredAt的時間是不是比較後面
  // 如果是的話就將_nextExpiredAt的時間往前更新
  // 並重新啟動setTimeout
  _updateNextExpired(ttl) {
    if (ttl === 0) return;
    const expiredAt = Date.now() + ttl;

    if (!this._nextExpiredAt
      || this._nextExpiredAt > expiredAt) {
      clearTimeout(this._timer);
      this._nextExpiredAt = expiredAt;
      const _interval = expiredAt - Date.now();
      this._timer = setTimeout(() => {
        this._onTick();
      }, _interval);
    }
  }

  _executionStrategy({ key, value }) {
    let strategy = { key, value, executed: false };
    switch (this.strategy) {
      // 將 iterator 的第一個從 Map 中移除
      case 'replace': {
        const [cacheKey, cacheValue] = this._cacheMap.entries().next().value;
        strategy = { key: cacheKey, value: cacheValue.value, executed: true };
        this._cacheMap.delete(cacheKey);
        break;
      }
      // 不做任何事，直接拋棄新的資料
      case 'drop':
      default:
        break;
    }

    return strategy;
  }

  set(key, value, { ttl } = {}) {
    const { to, is } = this.app.utils;

    let setValue = value;
    if (this.deepCopy) {
      // 將value deep copy一份進行儲存，避免造成memoery leak
      setValue = this.app.utils.to.json(value) || value;
    }

    // 如果目前的size已經等於maxSize，
    // 並且該key值並不存在於目前的Map裡，表示是新的資料，
    // 就需要判斷strategy並發送maxSize事件
    if (this.maxSize > 0
      && this._cacheMap.size >= this.maxSize
      && !this._cacheMap.has(key)
    ) {
      const strategy = this._executionStrategy({ key, value });
      // 如果有執行就重新 set 一次
      if (strategy.executed) {
        this.set(key, value, { ttl });
      }

      // 將被排除的資料發送事件出去
      let popValue = strategy.value;
      if (this.deepCopy) {
        // 將value deep copy一份進行儲存，避免造成memoery leak
        popValue = this.app.utils.to.json(strategy.value) || strategy.value;
      }
      this.emit('maxSize', strategy.key, popValue);
      return;
    }
    let _ttl = to.number(ttl) || 0;
    if (is.nullOrUndefined(ttl)) _ttl = this.defaultTTL;
    const _expiredAt = Date.now() + _ttl;

    const data = { value: setValue };
    if (_ttl > 0) {
      data.expiredAt = _expiredAt;
    }
    this._cacheMap.set(key, data);
    // 有新增的資料都要重新計算一次_nextExpiredAt
    this._updateNextExpired(_ttl);
  }

  get(key) {
    const data = this._cacheMap.get(key) || {};
    let popValue = data.value;
    if (this.deepCopy) {
      // 將value deep copy一份進行儲存，避免造成memoery leak
      popValue = this.app.utils.to.json(data.value) || data.value;
    }
    return popValue;
  }

  size() {
    return this._cacheMap.size;
  }

  has(key) {
    return this._cacheMap.has(key);
  }

  delete(key) {
    this._cacheMap.delete(key);
  }

  keys() {
    return Array.from(this._cacheMap.keys());
  }

  // 清除所有監聽與資料、停止timer
  close() {
    this.removeAllListeners();
    clearTimeout(this._timer);
    this._cacheMap.clear();
    this._cacheMap = null;
  }
}

module.exports = CachePool;
