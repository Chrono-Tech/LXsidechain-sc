pragma solidity ^0.4.23;

import "../../common/Owned.sol";
import "../../common/BaseRouter.sol";
import "./BlockReward.sol";
import "./LXBlockRewardProvider.sol";


contract LXBlockReward is BlockReward, Owned, BaseRouter {
    address constant SYSTEM_ADDRESS = 0xfffffffffffffffffffffffffffffffffffffffe;
    uint constant DEFAULT_BLOCK_REWARD = 5 * 10**18;

    address backendAddress;
    address public rewardProvider;

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
            if (rewardProvider != 0x0) {
                rewards[i] = LXBlockRewardProvider(rewardProvider).reward(benefactors[i], kind[i]);
            } else {
                rewards[i] = DEFAULT_BLOCK_REWARD;
            }
        }
        return (benefactors, rewards);
    }

    function setBackend(address _backend) onlyContractOwner external {
        backendAddress = _backend;
    }

    function setRewardProvider(address _rewardProvider) onlyContractOwner external {
        rewardProvider = _rewardProvider;
    }

    function backend() internal view returns (address) {
        return backendAddress;
    }

    modifier onlySystem {
        require(msg.sender == SYSTEM_ADDRESS);
        _;
    }
}
