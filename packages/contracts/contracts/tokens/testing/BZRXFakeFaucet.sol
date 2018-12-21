/**
 * Copyright 2017–2018, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.2;

import "../../openzeppelin-solidity/Ownable.sol";
import "../EIP20Wrapper.sol";


contract BZRXFakeFaucet is EIP20Wrapper, Ownable {

    uint public faucetThresholdSecs = 14400; // 4 hours

    mapping (address => mapping (address => uint)) public faucetUsers; // mapping of users to mapping of tokens to last request times

    function() external payable {}

    function faucet(
        address getToken,
        address receiver)
        public
        returns (bool)
    {
        require(block.timestamp-faucetUsers[receiver][getToken] >= faucetThresholdSecs 
            && block.timestamp-faucetUsers[msg.sender][getToken] >= faucetThresholdSecs, "BZRXFakeFaucet::faucet: token requested too recently");

        faucetUsers[receiver][getToken] = block.timestamp;
        faucetUsers[msg.sender][getToken] = block.timestamp;

        eip20Transfer(
            getToken,
            receiver,
            1 ether);

        return true;
    }

    function withdrawEther(
        address payable to,
        uint value)
        public
        onlyOwner
        returns (bool)
    {
        uint amount = value;
        if (amount > address(this).balance) {
            amount = address(this).balance;
        }

        return (to.send(amount)); // solhint-disable-line check-send-result, multiple-sends
    }

    function withdrawToken(
        address token,
        address to,
        uint tokenAmount)
        public
        onlyOwner
        returns (bool)
    {
        if (tokenAmount == 0) {
            return false;
        }
        
        eip20Transfer(
            token,
            to,
            tokenAmount);

        return true;
    }

    function depositToken(
        address token,
        address from,
        uint tokenAmount)
        public
        onlyOwner
        returns (bool)
    {
        if (tokenAmount == 0) {
            return false;
        }
        
        eip20TransferFrom(
            token,
            from,
            address(this),
            tokenAmount);

        return true;
    }

    function transferTokenFrom(
        address token,
        address from,
        address to,
        uint tokenAmount)
        public
        onlyOwner
        returns (bool)
    {
        if (tokenAmount == 0) {
            return false;
        }
        
        eip20TransferFrom(
            token,
            from,
            to,
            tokenAmount);

        return true;
    }

    function setFaucetThresholdSecs(
        uint newValue) 
        public
        onlyOwner
    {
        require(newValue != faucetThresholdSecs);
        faucetThresholdSecs = newValue;
    }
}
