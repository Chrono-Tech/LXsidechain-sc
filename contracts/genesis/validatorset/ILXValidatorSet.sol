/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.23;
import "./IValidatorSet.sol";


contract ILXValidatorSet is IValidatorSet {
	function initiateChange() public;
	function finalized() public view returns(bool);
}
