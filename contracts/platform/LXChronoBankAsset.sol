/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;

import "./ChronoBankAsset.sol";
import "./LXAssetTransferListener.sol";

contract LXChronoBankAsset is ChronoBankAsset {
    address public transferListener;

    /// @notice Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @dev function is final, and must not be overridden.
    /// @return success.
    function __transferWithReference(
        address _to,
        uint _value,
        string _reference,
        address _sender
    )
    onlyProxy
    public
    returns (bool)
    {
        bool result = _transferWithReference(_to, _value, _reference, _sender);
        if (result && transferListener != 0x0) {
            LXAssetTransferListener(transferListener).onTransfer(_sender, _to, _value, proxy.smbl());
        }
        return result;
    }

    /// @notice Passes execution into virtual function.
    /// Can only be called by assigned asset proxy.
    /// @dev function is final, and must not be overridden.
    /// @return success.
    function __transferFromWithReference(
        address _from,
        address _to,
        uint _value,
        string _reference,
        address _sender
    )
    onlyProxy
    public
    returns (bool)
    {
        bool result = _transferFromWithReference(_from, _to, _value, _reference, _sender);
        if (result && transferListener != 0x0) {
            LXAssetTransferListener(transferListener).onTransfer(_from, _to, _value, proxy.smbl());
        }
        return result;
    }
}
