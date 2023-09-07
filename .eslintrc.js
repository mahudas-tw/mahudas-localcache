module.exports = {
  root: true,
  env: {
    node: true,
  },
  parserOptions: {
    parser: 'babel-eslint',
    // 設定eslint的ecma版本
    ecmaVersion: 'latest',
  },
  extends: ['airbnb-base'],
  settings: {},
  plugins: [],
  rules: {
    // 很多時候會用底線開頭，尤其是MongoDB的_id衝突，關掉
    'no-underscore-dangle': 0,
    // max-len很煩，雖然取消，但還是盡量遵守比較好
    'max-len': 0,
    // 有時真的無法都用camelcase，關掉
    camelcase: 0,
  },
  globals: {},
};
