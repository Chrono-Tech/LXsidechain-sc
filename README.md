# LaborX Sidechain [![Build Status](https://travis-ci.org/ChronoBank/LXsidechain-sc.svg?branch=master)](https://travis-ci.org/ChronoBank/LXsidechain-sc)

## LX Smart Contracts

### Rewards

Earning rewards in _LaborX_ is one of the easiest things users can do. They should hold _TIME tokens_ on their accounts and be ready to interact with the system.

_LaborX_ platform has special smart contract that allows users to participate in rewards distribution - _TimeHolder_ contract. This contract has a ledger records that track who and how many tokens possess and lock them for some time until a user performs a withdraw.

Rewards are paid by periods so users should keep their tokens on _TimeHolder_ contract when they want to receive any rewards for that period. _TIME tokens_ (when they invested to _TimeHolder_) are transferred to a miner address which (according to PoS consensus concept) mines blocks and receive block rewards that will be distributed later.

Full cycle of holding TIMEs and rewards distribution looks :

- a user decides to participate in a mining and transfers his TIMEs to TimeHolder contract calling `TimeHolder#deposit(TIME, amount)` function (or now TIME token *supports ERC223* standard and a deposit could be performed by a simple `TIME#transfer(TimeHolder.address, amount)` call);
- now the user could receive rewards for holding his _TIMEs_ and providing them for mining. To check and withdraw rewards use `Rewards#rewardsFor(user)` and `Rewards#withdrawRewardTotal()` accordingly (or `Rewards#withdraRewards(amount)` to withdraw defined amount of rewards);
- when the user decides to stop mining then he could call `TimeHolder#withdrawShares(TIME, amount)` and he will receive tokens back on his account.

### Mining

Mining is the other option for TIME holders to earn a block reward. This functionality is based on locked TIME tokens that become designated tokens and participate in calculations of size of block rewards of each miner. As soon as simple deposit makes primary miner (or validator) to mine more since all deposits increase its part and amount of block rewards, locking tokens in _TimeHolder_ makes users a miner, keeps a total size of reward on the same level but reduces size of block rewards for primary miner. 

Becoming/resigning a miner role is performed by _TimeHolder_ contract and requires to have a deposit on _TimeHolder_'s account:

- a user wants to become a validator and deposits TIME tokens to TimeHolder by any suitable way (through `deposit` or `transfer`);
- then user locks some amount of tokens (all tokens or just a part) by `TimeHolder#lockDepositAndBecomeMiner(TIME, amount, delegate)`, where `delegate` is an account address that will replace a caller in a validators' chair and will receive all block rewards (sometimes users don't want to use their accounts in validating block so they could use this functionality to avoid a direct link with block validation). Delegatee is not able to unlock or withdraw tokens that were locked for his address so it is absolutely safe to do that - tokens could be unlocked at any time by a user who delegated a lock. In case if users don't want to delegate their role then just pass itself as a delegatee in `lockDepositAndBecomeMiner` function;
- when user decides not to be a validator anymore then he should call `TimeHolder#unlockDepositAndResignMiner(TIME)` and tokens will be immediatly returned to user's deposits in _TimeHolder_ and starts to be used by primary miner.

## LX Chain Configuration

TODO

### LX Chain Specification

TODO

#### Genesis file generator

Generation of genesis file could be performed in any network environment and testrpc is the easiest choise.

> Before a generation make sure that amount of migration transactions that will be run later is lower than a block number of validators' list switching (see `./scripts/genesis-template.json` field `engine.authorityRound.validators.multi.[block number]`). If it will be lower than a number of migrations then the network will transfer to invalid state where no valid _LXBlockReward_ contract will be found.

`./scripts/genesis_generate.js`

Usage:
```
genesis_generate.js --owner=<owner> --validators=<validators> --output=<output> --system=<system>
```
where
- `owner` (required): a deployer and genesis contracts owner,
- `validators` (required): an initial list of validators,
- `output` (required): an output file name, will be placed in `genesis` dir,
- `system` (optional): by default the SYSTEM_ADDRESS: 2^160 - 2

##### Production network genesis generation
```
truffle exec ./scripts/genesis_generate.js --owner="0x24495670DB97F50a404400d7aA155537E2fE09e8" --validators="0x24495670DB97F50a404400d7aA155537E2fE09e8" --output="lx-chain-prod.json"
```

[lx-chain-prod.json](./genesis/lx-chain-prod.json)

##### Test network genesis generation
```
truffle exec ./scripts/genesis_generate.js --owner="0xfebc7d461b970516c6d3629923c73cc6475f1d13" --validators="0x00aa39d30f0d20ff03a22ccfc30b7efbfca597c2,0x002e28950558fbede1a9675cb113f0bd20912019" --output="lx-chain-test.json"
```

[lx-chain-test.json](./genesis/lx-chain-test.json)

For more details, please refer to [Parity Chain Specification](https://wiki.parity.io/Chain-specification)

### Network configuration

Before starting a network with updated genesis file make sure that no more old data are left on a server. Execute `rm -rf ~/side-chain/data/node*` to remove (if they exists) node folders - it will preserve you from undefined network behavior.

#### Node configuration

Uses `docker-compose` to run nodes and other side services.

To check what services are run

`docker-compose ps`

To run services defined in `docker-compose.yml` execute

`docker-compose run -d`

To check logs for definite service, for example, `node-01`, execute

`docker-compose logs -f node-01`

To stop all runing services execute

`docker-compose down`

### Migrations

`./deploy-config.js`

Before migration to any network check out `deploy-config.js` first. It contains setup declaration of addresses and configurations needed to perform a successfull migration.

Every network have the next configuration fields:

- `owner` - owner address of base BlockRewards and ValidatorSet contracts (and, in future, possiblity for other contracts);

- `mining` - containst settings for mining and validation setup;

  - `tokenSymbol` - symbol of token that will be used for mining;

  - `depositLimit` - timeHolder's parameter, defines minimal amount of tokens needed to be deposited on TimeHolder's balance to become a miner;
  
  - `validatorSetContract` - parameters for ValidatorSet contract:

    - `address` - address of created contract;

    - `system` - address of system account (needed for initialization);

  - `blockRewardsContract` - parameters for BlockRewards contract:

    - `address` - address of created contract;

  - `primaryValidator` - validator address that is associated with the network, MUST BE SET;
  
  - `validators` - list of validators, additional validator addresses except primary validator address, could be empty.
