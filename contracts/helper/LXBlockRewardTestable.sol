/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;

import "../genesis/blockreward/LXBlockReward.sol";

contract LXBlockRewardTestable is LXBlockReward {
    constructor(address _owner)
    public {
        setInitialOwner(_owner);
    }
}
