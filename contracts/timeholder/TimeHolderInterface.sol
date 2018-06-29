/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


contract TimeHolderInterface {
    function getDepositBalance(address _token, address _depositor) public view returns(uint);
    function getLockedDepositBalance(address _token, address _depositor) public view returns(uint);
    function getLockedDepositBalanceForDelegate(address _token, address _delegate) public view returns(uint);
}
