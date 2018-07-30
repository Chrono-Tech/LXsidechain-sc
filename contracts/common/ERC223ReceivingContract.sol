/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


/// @title Contract that will work with ERC223 tokens. 
interface ERC223ReceivingContract { 
 
	/// @notice Standard ERC223 function that will handle incoming token transfers.
	/// @param _from  Token sender address.
	/// @param _value Amount of tokens.
	/// @param _data  Transaction metadata.
    function tokenFallback(address _from, uint _value, bytes _data) external;
}