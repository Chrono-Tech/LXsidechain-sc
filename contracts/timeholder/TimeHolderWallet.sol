/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;

import "../common/Object.sol";
import "../common/ERC223ReceivingContract.sol";
import { ERC20Interface as ERC20 } from "solidity-shared-lib/contracts/ERC20Interface.sol";


/**
* @title TimeHolder's wallet contract defines a basic implementation of DepositWalletInterface
* to provide a way to store/deposit/withdraw tokens on this contract according to access rights.
* Here deposit/withdraw are allowed only by TimeHolder contract.
*
* @dev Specifies a contract that helps in updating TimeHolder interface by delegating token's ownership
* to TimeHolderWallet contract
*/
contract TimeHolderWallet is Object {
    address public timeHolder;

    modifier onlyTimeHolder {
        require(msg.sender == timeHolder, "Only TimeHolder should make a call");
        _;
    }

    function init(address _timeHolder)
    external
    onlyContractOwner
    {
        require(_timeHolder != address(0x0));

        timeHolder = _timeHolder;
    }

    /**
    * Call `selfdestruct` when contract is not needed anymore. Also takes a list of tokens
    * that can be associated and have an account for this contract
    *
    * @dev Allowed only for contract owner
    *
    * @param tokens an array of tokens addresses
    *
    * @return result code of an operation
    */
    function destroy(address[] tokens)
    external
    onlyContractOwner
    {
        withdrawTokens(tokens);
        selfdestruct(contractOwner);
    }

    /**
    * Deposits some amount of tokens on wallet's account using ERC20 tokens
    *
    * @dev Allowed only for timeHolder
    *
    * @param _asset an address of token
    * @param _from an address of a sender who is willing to transfer her resources
    * @param _amount an amount of tokens (resources) a sender wants to transfer
    *
    * @return `true` if all successfuly completed, `false` otherwise
    */
    function deposit(address _asset, address _from, uint256 _amount)
    external
    onlyTimeHolder
    returns (bool)
    {
        return ERC20(_asset).transferFrom(_from, this, _amount);
    }

    /**
    * Withdraws some amount of tokens from wallet's account using ERC20 tokens
    *
    * @dev Allowed only for timeHolder
    *
    * @param _asset an address of token
    * @param _to an address of a receiver who is willing to get stored resources
    * @param _amount an amount of tokens (resources) a receiver wants to get
    *
    * @return `true` if all successfuly completed, `false` otherwise
    */
    function withdraw(address _asset, address _to, uint256 _amount)
    external
    onlyTimeHolder
    returns (bool)
    {
        return ERC20(_asset).transfer(_to, _amount);
    }

    function tokenFallback(address, uint, bytes) external {
        // do nothing but we know that we support all ERC20 and ERC223 tokens
    }
}
