# LaborX Sidechain

## LX Smart Contracts

TODO

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
