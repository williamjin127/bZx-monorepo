/**
 * Copyright 2017-2019, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.3;

import "../../openzeppelin-solidity/Ownable.sol";


contract TestNetPriceFeed is Ownable {

    uint256 public ethPrice = 210 ether;

    function read() 
        public 
        view 
        returns (bytes32)
    {
        return bytes32(ethPrice);
    }
    
    function changeEthPrice(
        uint256 _newPrice) 
        public 
        onlyOwner
        returns (bool)
    {
        ethPrice = _newPrice;
        return true;
    }
}