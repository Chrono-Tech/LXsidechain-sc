/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "./Owned.sol";
import "../common/ERC20.sol";


/**
 * @title Generic owned destroyable contract
 */
contract Object is Owned {
    /**
    *  Common result code. Means everything is fine.
    */
    uint constant OK = 1;

    function withdrawnTokens(address[] tokens, address _to) onlyContractOwner public returns (uint) {
        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint balance = ERC20(token).balanceOf(this);
            if (balance != 0) {
                ERC20(token).transfer(_to, balance);
            }
        }
        return OK;
    }
}
