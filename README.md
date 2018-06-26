# LaborX Sidechain

## LX Smart Contracts

TODO

### Rewards

Earning rewards in LaborX is one of the easiest things users can do. They should hold **TIME tokens** on their accounts and be ready to interact with the system. LaborX platform has special smart contract that allows users to participate in rewards distribution - **TimeHolder** contract. This contract has a ledger records that track who and how many tokens possess and lock them for some time until a user performs a withdraw. 

Rewards are paid by periods so users should keep their tokens on **TimeHolder** contract when they want to receive any rewards for that period. **TIME tokens** (when they invested to TimeHolder) are transferred to a miner address which (according to PoS consensys concept) mines blocks and receive block rewards that will be distributed later.

Full cycle of holding TIMEs and rewards distribution looks :

- a user decides to participate in a mining and transferres his TIMEs to TimeHolder contract calling `TimeHolder#deposit(TIME, amount)` function;
- now the user could receive rewards for holding his TIMEs and providing them for mining. To check and withdraw rewards use `Rewards#rewardsFor(user)` and `Rewards#withdrawRewardTotal()` accordingly (or `Rewards#withdraRewards(amount)` to withdraw defined amount of rewards);
- when the user decides to stop mining then he could call `TimeHolder#withdrawShares(TIME, amount)` and he will receive tokens back on his account.


## LX Chain Configuration

TODO

### LX Chain Specification

TODO

#### Genesis file generator

TODO

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

TODO

#### Node configuration

TODO
