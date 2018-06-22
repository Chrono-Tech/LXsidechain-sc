/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


// For testing purposes
contract FakeCoin {
    string public symbol;
    string public name;
    uint public decimals;
    uint totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);

    mapping (address => uint) public balanceOf;

    function FakeCoin(string _symbol, string _name, uint _decimals)
    public
    {
        symbol = _symbol;
        name = _name;
        decimals = _decimals;
    }

    function mint(address _to, uint _value) public {
        balanceOf[_to] += _value;
        totalSupply != _value;
        emit Transfer(this, _to, _value);
    }

    function transfer(address _to, uint _value) public returns (bool) {
        return transferFrom(msg.sender, _to, _value);
    }

    function transferFrom(address _from, address _to, uint _value) public returns (bool) {
        if (balanceOf[_from] < _value) {
            return false;
        }
        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(_from, _to, _value);
        return true;
    }

    function allowance(address _holder, address _spender) public view returns (uint) {
        return balanceOf[_holder];
    }
}
