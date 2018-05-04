/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "./FakeCoin.sol";


// For testing purposes.
contract FakeCoin3 is FakeCoin {

    function symbol() public pure returns (string) {
        return "FAKE3";
    }
}
