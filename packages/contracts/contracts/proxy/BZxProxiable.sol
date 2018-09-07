/**
 * Copyright 2017–2018, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */
 
pragma solidity 0.4.24;

import "../storage/BZxStorage.sol";


contract BZxProxiable {
    mapping (bytes4 => address) public targets;

    mapping (bytes4 => bool) public targetIsPaused;

    function initialize(address _target) public;

    function _replaceContract(address _target) internal {
        require(_target.delegatecall(bytes4(keccak256("initialize(address)")), _target), "Proxiable::_replaceContract: failed");
    }
}
