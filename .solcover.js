require('babel-register');
require('babel-polyfill');

module.exports = {
  copyNodeModules: true,
  skipFiles: ['migration/Migrations.sol',
              'lib/SafeMath.sol',
              'helper/FakeCoin.sol',
              'event/MultiEventsHistory.sol'],
}
