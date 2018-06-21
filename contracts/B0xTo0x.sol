
pragma solidity ^0.4.24; // solhint-disable-line compiler-fixed

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./tokens/EIP20.sol";
import "./tokens/EIP20Wrapper.sol";
import "./modifiers/B0xOwnable.sol";


interface ExchangeInterface {
    event LogError(uint8 indexed errorId, bytes32 indexed orderHash);

    function fillOrder(
          address[5] orderAddresses,
          uint[6] orderValues,
          uint fillTakerTokenAmount,
          bool shouldThrowOnInsufficientBalanceOrAllowance,
          uint8 v,
          bytes32 r,
          bytes32 s)
          external
          returns (uint filledTakerTokenAmount);

    function isValidSignature(
        address signer,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s)
        external
        constant
        returns (bool);
}


contract B0xTo0x is EIP20Wrapper, B0xOwnable {
    using SafeMath for uint256;

    address public exchangeContract;
    address public zrxTokenContract;
    address public tokenTransferProxyContract;

    //event LogErrorUint(string errorTxt, uint errorValue, bytes32 indexed orderHash);
    //event LogErrorAddr(string errorTxt, address errorAddr, bytes32 indexed orderHash);

    function() 
        public {
        revert();
    }

    constructor(
        address _exchange, 
        address _zrxToken,
        address _proxy) 
        public 
    {
        exchangeContract = _exchange;
        zrxTokenContract = _zrxToken;
        tokenTransferProxyContract = _proxy;
    }

   function take0xTrade(
        address trader,
        address vaultAddress,
        uint sourceTokenAmountToUse,
        bytes orderData0x, // 0x order arguments, converted to hex, padded to 32 bytes and concatenated
        bytes signiture0x) // ECDSA of the 0x order
        public
        onlyB0x
        returns (
            address destTokenAddress,
            uint destTokenAmount,
            uint sourceTokenUsedAmount)
    {
        // address[5], uint[6], bytes (uint8, bytes32, bytes32)
        address[5] memory orderAddresses0x;
        uint[6] memory orderValues0x;
        (orderAddresses0x, orderValues0x) = getOrderValuesFromData(orderData0x);

    /*
        LogErrorAddr("maker", orderAddresses0x[0], 0x0);
        LogErrorAddr("taker", orderAddresses0x[1], 0x0);
        LogErrorAddr("makerToken", orderAddresses0x[2], 0x0);
        LogErrorAddr("takerToken", orderAddresses0x[3], 0x0);
        LogErrorAddr("feeRecipient", orderAddresses0x[4], 0x0);
        LogErrorUint("makerTokenAmount", orderValues0x[0], 0x0);
        LogErrorUint("takerTokenAmount", orderValues0x[1], 0x0);
        LogErrorUint("makerFee", orderValues0x[2], 0x0);
        LogErrorUint("takerFee", orderValues0x[3], 0x0);
        LogErrorUint("expirationTimestampInSec", orderValues0x[4], 0x0);
        LogErrorUint("salt", orderValues0x[5], 0x0);
    */
    

    /*
        orderAddresses0x[0], // maker
        orderAddresses0x[1], // taker
        orderAddresses0x[2], // makerToken
        orderAddresses0x[3], // takerToken
        orderAddresses0x[4], // feeRecipient
        orderValues0x[0],    // makerTokenAmount
        orderValues0x[1],    // takerTokenAmount
        orderValues0x[2],    // makerFee
        orderValues0x[3],    // takerFee
        orderValues0x[4],    // expirationTimestampInSec
        orderValues0x[5]     // salt
    */

        sourceTokenUsedAmount = _take0xTrade(
            trader,
            sourceTokenAmountToUse,
            orderAddresses0x,
            orderValues0x,
            signiture0x);

        if (sourceTokenUsedAmount < sourceTokenAmountToUse) {
            // all sourceToken has to be traded
            revert("B0xTo0x::take0xTrade: sourceTokenUsedAmount < sourceTokenAmountToUse");
        }

        destTokenAmount = getPartialAmount(
            sourceTokenUsedAmount,
            orderValues0x[1], // takerTokenAmount (aka sourceTokenAmount)
            orderValues0x[0] // makerTokenAmount (aka destTokenAmount)
        );

        // transfer the destToken to the vault
        eip20Transfer(
            orderAddresses0x[2],
            vaultAddress,
            destTokenAmount);

        destTokenAddress = orderAddresses0x[2]; // makerToken (aka destTokenAddress)
    }

    function _take0xTrade(
        address trader,
        uint sourceTokenAmountToUse,
        address[5] orderAddresses0x,
        uint[6] orderValues0x,
        bytes signature)
        internal
        returns (uint) 
    {
        if (orderAddresses0x[4] != address(0) && // feeRecipient
                orderValues0x[3] > 0 // takerFee
        ) {
            // The 0x TokenTransferProxy already has unlimited transfer allowance for ZRX from this contract (set during deployment of this contract)
            eip20TransferFrom(
                zrxTokenContract,
                trader,
                this,
                orderValues0x[3]);
        }

        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = getSignatureParts(signature);

        // Increase the allowance for 0x Exchange Proxy to transfer the sourceToken needed for the 0x trade
        // orderAddresses0x[3] -> takerToken/sourceToken
        eip20Approve(
            orderAddresses0x[3],
            tokenTransferProxyContract,
            EIP20(orderAddresses0x[3]).allowance(this, tokenTransferProxyContract).add(sourceTokenAmountToUse));

        uint sourceTokenUsedAmount = ExchangeInterface(exchangeContract).fillOrder(
            orderAddresses0x,
            orderValues0x,
            sourceTokenAmountToUse,
            false, // shouldThrowOnInsufficientBalanceOrAllowance
            v,
            r,
            s);

        return sourceTokenUsedAmount;
    }

    function getOrderValuesFromData(
        bytes orderData0x)
        public
        pure
        returns (
            address[5] orderAddresses,
            uint[6] orderValues) 
    {
        address maker;
        address taker;
        address makerToken;
        address takerToken;
        address feeRecipient;
        uint makerTokenAmount;
        uint takerTokenAmount;
        uint makerFee;
        uint takerFee;
        uint expirationTimestampInSec;
        uint salt;
        assembly {
            maker := mload(add(orderData0x, 32))
            taker := mload(add(orderData0x, 64))
            makerToken := mload(add(orderData0x, 96))
            takerToken := mload(add(orderData0x, 128))
            feeRecipient := mload(add(orderData0x, 160))
            makerTokenAmount := mload(add(orderData0x, 192))
            takerTokenAmount := mload(add(orderData0x, 224))
            makerFee := mload(add(orderData0x, 256))
            takerFee := mload(add(orderData0x, 288))
            expirationTimestampInSec := mload(add(orderData0x, 320))
            salt := mload(add(orderData0x, 352))
        }
        orderAddresses = [
            maker,
            taker,
            makerToken,
            takerToken,
            feeRecipient
        ];
        orderValues = [
            makerTokenAmount,
            takerTokenAmount,
            makerFee,
            takerFee,
            expirationTimestampInSec,
            salt
        ];
    }

    /// @param signature ECDSA signature in raw bytes (rsv).
    function getSignatureParts(
        bytes signature)
        public
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s)
    {
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := mload(add(signature, 65))
        }
        if (v < 27) {
            v = v + 27;
        }
    }

    /// @dev Calculates partial value given a numerator and denominator.
    /// @param numerator Numerator.
    /// @param denominator Denominator.
    /// @param target Value to calculate partial of.
    /// @return Partial value of target.
    function getPartialAmount(uint numerator, uint denominator, uint target)
        public
        pure
        returns (uint)
    {
        return SafeMath.div(SafeMath.mul(numerator, target), denominator);
    }

    function set0xExchange (
        address _exchange)
        public
        onlyOwner
    {
        exchangeContract = _exchange;
    }

    function setZRXToken (
        address _zrxToken)
        public
        onlyOwner
    {
        zrxTokenContract = _zrxToken;
    }

    function set0xTokenProxy (
        address _proxy)
        public
        onlyOwner
    {
        tokenTransferProxyContract = _proxy;
    }

    function approveFor (
        address token,
        address spender,
        uint value)
        public
        onlyOwner
        returns (bool)
    {
        eip20Approve(
            token,
            spender,
            value);

        return true;
    }
}
