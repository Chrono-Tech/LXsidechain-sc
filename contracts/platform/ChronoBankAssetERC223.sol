/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAsset.sol";
import "../common/ERC223ReceivingContract.sol";


contract ChronoBankAssetERC223 is ChronoBankAsset {

    function _transferWithReference(
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    )
    internal
    returns (bool _result)
    {
        _result = super._transferWithReference(_to, _value, _reference, _sender);
        if (!_result) {
            return false;
        }

        if (_isContract(_to)) {
            bytes memory _empty;
            ERC223ReceivingContract(_to).tokenFallback(_sender, _value, _empty);
        }

        return true;
    }

    function _transferFromWithReference(
        address _from, 
        address _to, 
        uint _value, 
        string _reference, 
        address _sender
    )
    internal
    returns (bool _result) {
        _result = super._transferFromWithReference(_from, _to, _value, _reference, _sender);
        if (!_result) {
            return false;
        }

        if (_isContract(_to)) {
            bytes memory _empty;
            ERC223ReceivingContract(_to).tokenFallback(_from, _value, _empty);
        }
        
        return true;
    }

    function _isContract(address _target) 
    private 
    view 
    returns (bool) 
    {
        uint _codeLength;
        assembly {
            _codeLength := extcodesize(_target)
        }

        return _codeLength > 0;
    }
}