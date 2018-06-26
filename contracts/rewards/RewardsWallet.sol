/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;

import "../common/Object.sol";
import { ERC20Interface as ERC20 } from "solidity-shared-lib/contracts/ERC20Interface.sol";


/**
* @title TimeHolder's wallet contract defines a basic implementation of DepositWalletInterface
* to provide a way to store/deposit/withdraw tokens on this contract according to access rights.
* Here deposit/withdraw are allowed only by TimeHolder contract.
*
* @dev Specifies a contract that helps in updating TimeHolder interface by delegating token's ownership
* to TimeHolderWallet contract
*/
contract RewardsWallet is Object {
    event EthReceived(address sender, uint value);
    address public rewards;

    modifier onlyRewards {
        require(msg.sender == rewards, "Rewards contract should only call this function");
        _;
    }

    function init(address _rewards)
    external
    onlyContractOwner
    {
        require(_rewards != address(0x0));

        rewards = _rewards;
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
    public
    onlyContractOwner
    {
        withdrawTokens(tokens);
        selfdestruct(msg.sender);
    }

    /**
    * Deposits some amount of tokens on wallet's account using ERC20 tokens
    *
    * @dev Allowed only for rewards
    *
    * @param _asset an address of token
    * @param _from an address of a sender who is willing to transfer her resources
    * @param _amount an amount of tokens (resources) a sender wants to transfer
    *
    * @return `true` if all successfuly completed, `false` otherwise
    */
    function deposit(address _asset, address _from, uint256 _amount)
    external
    onlyRewards
    returns (bool)
    {
        return ERC20(_asset).transferFrom(_from, this, _amount);
    }

    /**
    * Withdraws some amount of tokens from wallet's account using ERC20 tokens
    *
    * @dev Allowed only for rewards
    *
    * @param _asset an address of token
    * @param _to an address of a receiver who is willing to get stored resources
    * @param _amount an amount of tokens (resources) a receiver wants to get
    *
    * @return `true` if all successfuly completed, `false` otherwise
    */
    function withdraw(address _asset, address _to, uint256 _amount)
    external
    onlyRewards
    returns (bool)
    {
        return ERC20(_asset).transfer(_to, _amount);
    }

    function withdrawEth(address _to, uint256 _amount)
    external
    onlyRewards
    returns (bool)
    {
        return _to.send(_amount);
    }

    function ()
    external
    payable
    {
        require(msg.value > 0);
        emit EthReceived(msg.sender, msg.value);
    }
}
