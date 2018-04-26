pragma solidity ^0.4.23;

import "../../common/Owned.sol";
import "./IBlockReward.sol";
import "../../validators/LXValidatorManager.sol";


contract LXBlockReward is IBlockReward, Owned {
    address constant SYSTEM_ADDRESS = 0xfffffffffffffffffffffffffffffffffffffffe;
    uint constant DEFAULT_BLOCK_REWARD = 5 * 10**18;
    address public dataProvider;

    modifier onlySystem {
        require(msg.sender == SYSTEM_ADDRESS);
        _;
    }

    constructor(address _owner) {
        require(_owner != 0x0);
        // TODO: ahiatsevich - why this does not work by default
        contractOwner = _owner;
    }

    // produce rewards for the given benefactors, with corresponding reward codes.
    // only callable by `SYSTEM_ADDRESS`
    function reward(address[] benefactors, uint16[] kind)
    external
    onlySystem
    returns (address[], uint256[])
    {
        require(benefactors.length == kind.length);

        uint256[] memory rewards = new uint256[](benefactors.length);

        for (uint i = 0; i < rewards.length; i++) {
            if (dataProvider != 0x0) {
                rewards[i] = LXValidatorManager(dataProvider).reward(benefactors[i], kind[i]);
            } else {
                rewards[i] = DEFAULT_BLOCK_REWARD;
            }
        }

        return (benefactors, rewards);
    }

    function setDataProvider(address _dataProvider) onlyContractOwner external {
        dataProvider = _dataProvider;
    }
}
