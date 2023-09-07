# mahudas-localcache
Mahudas的plugin，針對本機進行資料的cache。
+ 可以依照任務的區分建立多個cache pool
+ 每個cache pool可以設定自己的maxSize、TTL、以及strategy(資料滿的時候的取捨策略)

## 安裝
```
npm i @mahudas/localcache
```
並依照Mahudas的plugin方式啟用

## CachePool的建立、取得與銷毀
要儲存資料前，需要建立CachePool，每個CachePool可以依照名稱來識別，並設定各自的參數。  
建立後可以得到CachePool的instance。  
```js
// 建立
const pool = app.localCache.createPool('for test', {
  maxSize:10, defaultTTL: 60*1000, strategy:'drop'
  });

// 取得pool
const pool = app.localCache.getPool('for test');

// 銷毀pool
app.localCache.deletePool('for test');
```
### createPool的參數(cacheOptions)說明
參數 | 型別 | 預設 | 說明
--- | --- | --- | ---
maxSize | Number | 0 | 最多可以儲存的資料筆數，0=無限制
defaultTTL | Number | 0 | 儲存的資料在多少ms之後自動清除，0=無限
strategy | String | 'replace' | 當資料量已經到達maxSize時，加入新資料時的採取策略。 `replace`=移除最早被加入的資料，`drop`=拋棄原本要加入的新資料

## CachePool的操作
method | 說明
--- | ---
setOptions(cacheOptions):void | 設定(覆蓋)參數
set(key, value, { ttl }):void | 設定資料
get(key):* | 取得資料
delete(key):void | 刪除某筆資料
keys():Array | 取得目前的所有key值(陣列)
has(key):Boolean | 是否有某個key值的資料
size() | 取得目前CachePool的資料數量
close() | 清除所有資料(不建議直接使用)

盡量避免直接呼叫CachePool.close()，如果要移除某個CachePool，請使用
```js
app.localCache.deletePool('cache pool name');
```

## 事件
CachePool提供兩個事件：

### maxSize
當maxSize已滿，再加入新的資料時會觸發這個事件。  
事件觸發時會回傳「被捨棄的資料」。  
被捨棄的資料是依照 `cacheOptions.strategy` 來決定。  
```js
pool.on('maxSize', (key, value)=> {
  console.log(`被捨棄的是 ${key}`);
});
```

### expired
當有資料過期被移除時觸發。  
觸發時會回傳「被捨棄的資料」。 
```js
pool.on('expired', (key, value)=> {
  console.log(`被捨棄的是 ${key}`);
});
```