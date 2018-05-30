pragma solidity ^0.4.23;

interface LXAssetListener {
    function onTransfer(address _from, address _to, uint value, bytes32 _symbol) public;
}
