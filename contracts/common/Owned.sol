pragma solidity ^0.4.23;


/**
* @title Ownable
* @dev The Ownable contract has an owner address, and provides basic authorization control
* functions, this simplifies the implementation of "user permissions".
*/
contract Owned {
	address public contractOwner;

	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

	/**
	* @dev The Ownable constructor sets the original `owner` of the contract to the sender
	* account.
	*/
	constructor() public {
		contractOwner = msg.sender;
	}

	/**
	* @dev Throws if called by any account other than the owner.
	*/

	modifier onlyContractOwner {
		require(msg.sender == contractOwner, "Only contract owner");
		_;
	}

	/**
	* @dev Allows the current owner to transfer control of the contract to a newOwner.
	* @param newOwner The address to transfer ownership to.
	*/
	function transferOwnership(address newOwner) public onlyContractOwner {
		require(newOwner != address(0));
		emit OwnershipTransferred(contractOwner, newOwner);
		contractOwner = newOwner;
	}
}
