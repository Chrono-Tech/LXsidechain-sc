/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "../common/BaseManager.sol";


contract Deposits is BaseManager {
    StorageInterface.OrderedAddressesSet internal shareholders;
    StorageInterface.UIntOrderedSetMapping internal deposits;
    StorageInterface.UInt internal depositsIdCounter;
    StorageInterface.AddressUIntUIntMapping internal amounts;
    StorageInterface.AddressUIntUIntMapping internal timestamps;
    StorageInterface.UInt internal totalSharesStorage;
    StorageInterface.Address internal sharesContractStorage;

    constructor(Storage _store, bytes32 _crate)
    public
    BaseManager(_store, _crate)
    {
        shareholders.init("shareholders");
        deposits.init("deposits");
        depositsIdCounter.init("depositsIdCounter");
        amounts.init("amounts");
        timestamps.init("timestamps");
        totalSharesStorage.init("totalSharesStorage");
        sharesContractStorage.init("sharesContractStorage");
    }

    /**
     * Returns shares amount deposited by a particular shareholder.
     *
     * @param _address shareholder address.
     *
     * @return shares amount.
     */
    function depositBalance(address _address)
    public
    view
    returns (uint balance)
    {
        StorageInterface.Iterator memory iterator = store.listIterator(deposits, bytes32(_address));
        for(uint i = 0; store.canGetNextWithIterator(deposits, iterator); i++) {
            uint _cur_amount = store.get(amounts, _address, store.getNextWithIterator(deposits, iterator));
            balance += _cur_amount;
        }
        return balance;
    }

}
