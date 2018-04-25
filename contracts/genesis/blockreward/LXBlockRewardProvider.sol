pragma solidity ^0.4.23;

import "./BlockReward.sol";
import "../../common/Owned.sol";


contract LXBlockRewardProvider is Owned {
    mapping (address => mapping (uint => uint)) public rewards;
    mapping (address => bool) public authorised;

    modifier onlyAuthorised {
  		  require(msg.sender == contractOwner || authorised[msg.sender]);
  		  _;
  	}

    function reward(address _benefactor, uint _kind) view public returns (uint) {
        return rewards[_benefactor][_kind];
    }

    function setReward(address _benefactor, uint _kind, uint _reward) onlyAuthorised view public {
        rewards[_benefactor][_kind] = _reward;
    }
}
