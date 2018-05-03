/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */
 
pragma solidity ^0.4.23;

import "../common/Owned.sol";

contract LXValidatorSetDelegate is Owned {
  address public validatorSet;

  modifier onlyValidatorSet() {
      require(msg.sender == validatorSet);
      _;
  }

  constructor(address _validatorSet) public {
    validatorSet = _validatorSet;
  }

  function initiateChange()
  public
  onlyValidatorSet
  {
  }

  function iinalizeChange()
  public
  onlyValidatorSet
  {
  }

  function addValidator(address /*_validator*/)
  public
  onlyValidatorSet
  {
  }

  function removeValidator(address /*_validator*/)
  public
  onlyValidatorSet
  {
  }

  function setRecentBlocks(uint /*_recentBlocks*/)
  public
  onlyValidatorSet
  {
  }

  function reportMalicious(address /*_validator*/, uint /*_blockNumber*/, bytes /*_proof*/)
  public
  onlyValidatorSet
  {
  }

  function reportBenign(address /*_validator*/, uint /*_blockNumber*/)
  public
  onlyValidatorSet
  {
  }
}
