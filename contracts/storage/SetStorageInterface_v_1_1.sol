/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "./StorageInterface.sol";


/// @title Storage library
/// Library is intended to provide backward compatibility with old contracts
/// that use collections (such as Set, AddressesSet, CounterSet) with 
/// old-fasion value storing without mixing with `salt`.
library SetStorageInterface_v_1_1 {

	function init(StorageInterface.Set storage self, bytes32 _id) public {
		StorageInterface.init(self.count, keccak256(_id, "count"));
		StorageInterface.init(self.indexes, keccak256(_id, "indexes"));
		StorageInterface.init(self.values, keccak256(_id, "values"));
	}

	function init(StorageInterface.AddressesSet storage self, bytes32 _id) public {
		init(self.innerSet, _id);
	}

	function init(StorageInterface.CounterSet storage self, bytes32 _id) public {
		init(self.innerSet, _id);
	}

	function set(StorageInterface.Config storage self, StorageInterface.Set storage item, bytes32 _oldValue, bytes32 _newValue) public {
		if (!includes(self, item, _oldValue)) {
			return;
		}

		uint _index = uint(StorageInterface.get(self, item.indexes, _oldValue));
		StorageInterface.set(self, item.values, bytes32(_index), _newValue);
		StorageInterface.set(self, item.indexes, _newValue, bytes32(_index));
		StorageInterface.set(self, item.indexes, _oldValue, bytes32(0));
	}

	function set(StorageInterface.Config storage self, StorageInterface.AddressesSet storage item, address _oldValue, address _newValue) public {
		set(self, item.innerSet, bytes32(_oldValue), bytes32(_newValue));
	}

	function add(StorageInterface.Config storage self, StorageInterface.Set storage item, bytes32 _value) public {
		if (includes(self, item, _value)) {
			return;
		}

		uint _newCount = count(self, item) + 1;
		StorageInterface.set(self, item.values, bytes32(_newCount), _value);
		StorageInterface.set(self, item.indexes, _value, bytes32(_newCount));
		StorageInterface.set(self, item.count, _newCount);
	}

	function add(StorageInterface.Config storage self, StorageInterface.AddressesSet storage item, address _value) public {
		add(self, item.innerSet, bytes32(_value));
	}

	function add(StorageInterface.Config storage self, StorageInterface.CounterSet storage item) public {
		add(self, item.innerSet, bytes32(count(self, item)));
	}

	function remove(StorageInterface.Config storage self, StorageInterface.Set storage item, bytes32 _value) public {
		if (!includes(self, item, _value)) {
			return;
		}

		uint _lastIndex = count(self, item);
		bytes32 _lastValue = StorageInterface.get(self, item.values, bytes32(_lastIndex));
		uint _index = uint(StorageInterface.get(self, item.indexes, _value));
		if (_index < _lastIndex) {
			StorageInterface.set(self, item.indexes, _lastValue, bytes32(_index));
			StorageInterface.set(self, item.values, bytes32(_index), _lastValue);
		}

		StorageInterface.set(self, item.indexes, _value, bytes32(0));
		StorageInterface.set(self, item.values, bytes32(_lastIndex), bytes32(0));
		StorageInterface.set(self, item.count, _lastIndex - 1);
	}

	function remove(StorageInterface.Config storage self, StorageInterface.AddressesSet storage item, address _value) public {
		remove(self, item.innerSet, bytes32(_value));
	}

	function remove(StorageInterface.Config storage self, StorageInterface.CounterSet storage item, uint _value) public {
		remove(self, item.innerSet, bytes32(_value));
	}

	function count(StorageInterface.Config storage self, StorageInterface.Set storage item) public view returns (uint) {
		return StorageInterface.get(self, item.count);
	}

	function count(StorageInterface.Config storage self, StorageInterface.AddressesSet storage item) public view returns (uint) {
		return count(self, item.innerSet);
	}

	function count(StorageInterface.Config storage self, StorageInterface.CounterSet storage item) public view returns (uint) {
		return count(self, item.innerSet);
	}

	function includes(StorageInterface.Config storage self, StorageInterface.Set storage item, bytes32 _value) public view returns (bool) {
		return StorageInterface.get(self, item.indexes, _value) != 0;
	}

	function includes(StorageInterface.Config storage self, StorageInterface.AddressesSet storage item, address _value) public view returns (bool) {
		return includes(self, item.innerSet, bytes32(_value));
	}

	function includes(StorageInterface.Config storage self, StorageInterface.CounterSet storage item, uint _value) public view returns (bool) {
		return includes(self, item.innerSet, bytes32(_value));
	}

	function get(StorageInterface.Config storage self, StorageInterface.Set storage item, uint _index) public view returns (bytes32) {
		return StorageInterface.get(self, item.values, bytes32(_index + 1));
	}

	function get(StorageInterface.Config storage self, StorageInterface.AddressesSet storage item, uint _index) public view returns (address) {
		return address(get(self, item.innerSet, _index));
	}

	function get(StorageInterface.Config storage self, StorageInterface.CounterSet storage item, uint _index) public view returns (uint) {
		return uint(get(self, item.innerSet, _index));
	}

	function getIndex(StorageInterface.Config storage self, StorageInterface.Set storage item, bytes32 _value) public view returns (uint) {
		return uint(StorageInterface.get(self, item.indexes, _value));
	}

	function getIndex(StorageInterface.Config storage self, StorageInterface.AddressesSet storage item, address _value) public view returns (uint) {
		return getIndex(self, item.innerSet, bytes32(_value));
	}

	function getIndex(StorageInterface.Config storage self, StorageInterface.CounterSet storage item, uint _value) public view returns (uint) {
		return getIndex(self, item.innerSet, bytes32(_value));
	}
}