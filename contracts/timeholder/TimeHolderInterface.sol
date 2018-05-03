/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


contract TimeHolderInterface {
    function wallet() public view returns (address);
    function totalShares(bytes32 symbol) public view returns (uint);
    function sharesContract() public view returns (address);
    function getDefaultShares() public view returns (address);
    function defaultShareholdersCount() public view returns (uint);
    function shareholdersCount(address) public view returns (uint);
    function depositBalance(address _address) public view returns(uint);
}
