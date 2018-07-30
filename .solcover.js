require('babel-register');
require('babel-polyfill');

module.exports = {
  copyNodeModules: true,
  skipFiles: [
    'migration/Migrations.sol',
    'migration/Imports.sol',
    'lib/SafeMath.sol',
    'helper/FakeCoin.sol',
  ],
}
