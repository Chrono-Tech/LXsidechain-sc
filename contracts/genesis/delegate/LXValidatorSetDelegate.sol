pragma solidity ^0.4.23;

import "../../common/Owned.sol";
import "../validatorset/LXValidatorSetDelegateInterface.sol";


contract LXValidatorSetDelegate is LXValidatorSetDelegateInterface, Owned {
  address public validatorSet;

  modifier onlyValidatorSet() {
      require(msg.sender == validatorSet);
      _;
  }

  function InnerOwnedSet(address _validatorSet) public {
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

  function addValidator(address _validator)
  public
  onlyValidatorSet
  {
  }

  function removeValidator(address _validator)
  public
  onlyValidatorSet
  {
  }

  function setRecentBlocks(uint _recentBlocks)
  public
  onlyValidatorSet
  {
  }

  function reportMalicious(address _validator, uint _blockNumber, bytes _proof)
  public
  onlyValidatorSet
  {
  }

  function reportBenign(address _validator, uint _blockNumber)
  public
  onlyValidatorSet
  {
  }
}
