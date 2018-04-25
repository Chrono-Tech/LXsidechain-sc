pragma solidity ^0.4.23;


contract LXValidatorSetDelegateInterface {
  function initiateChange() public;
  function finalizeChange() public;
  function addValidator(address _validator) public;
  function removeValidator(address _validator) public;
  function setRecentBlocks(uint _recentBlocks) public;
  function reportMalicious(address _validator, uint _blockNumber, bytes _proof) public;
  function reportBenign(address _validator, uint _blockNumber) public;
}
