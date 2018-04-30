
pragma solidity ^0.4.23;

import 'zeppelin-solidity/contracts/math/Math.sol';

import './B0xStorage.sol';
import './B0xProxyContracts.sol';
import '../shared/InternalFunctions.sol';

import '../B0xVault.sol';
import '../interfaces/Oracle_Interface.sol';
import '../interfaces/B0xTo0x_Interface.sol';

import '../tokens/EIP20.sol';

contract B0xTradePlacing is B0xStorage, Proxiable, InternalFunctions {
    using SafeMath for uint256;

    constructor() public {}
    
    function initialize(
        address _target)
        public
        onlyOwner
    {
        targets[bytes4(keccak256("tradePositionWith0x(bytes32,bytes,bytes)"))] = _target;
        targets[bytes4(keccak256("tradePositionWithOracle(bytes32,address)"))] = _target;
    }
    
    /// @dev Executes a 0x trade using loaned funds.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param orderData0x 0x order arguments, converted to hex, padded to 32 bytes and concatenated
    /// @param signiture0x ECDSA of the 0x order
    /// @return The amount of token received in the trade.
    function tradePositionWith0x(
        bytes32 loanOrderHash,
        bytes orderData0x,
        bytes signiture0x)
        external
        nonReentrant
        tracksGas
        returns (uint)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return intOrRevert(0,46);
        }

        if (block.timestamp >= loanOrder.expirationUnixTimestampSec) {
            return intOrRevert(0,50);
        }

        LoanPosition storage loanPosition = loanPositions[loanOrderHash][msg.sender];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return intOrRevert(0,55);
        }

        // transfer the current position token to the B0xTo0x contract
        if (!B0xVault(VAULT_CONTRACT).withdrawToken(
            loanPosition.positionTokenAddressFilled,
            B0XTO0X_CONTRACT,
            loanPosition.positionTokenAmountFilled)) {
            return intOrRevert(0,63);
        }

        address tradeTokenAddress;
        uint tradeTokenAmount;
        uint positionTokenUsedAmount;
        (tradeTokenAddress, tradeTokenAmount, positionTokenUsedAmount) = B0xTo0x_Interface(B0XTO0X_CONTRACT).take0xTrade(
            msg.sender, // trader
            VAULT_CONTRACT,
            loanPosition.positionTokenAmountFilled,
            orderData0x,
            signiture0x);

        if (tradeTokenAmount == 0 || positionTokenUsedAmount != loanPosition.positionTokenAmountFilled) {
            return intOrRevert(0,77);
        }

        if (DEBUG_MODE) {
            _emitMarginLog(loanOrder, loanPosition);
        }

        // trade token has to equal loan token if loan needs to be liquidated
        if (tradeTokenAddress != loanOrder.loanTokenAddress && Oracle_Interface(loanOrder.oracleAddress).shouldLiquidate(
                loanOrderHash,
                msg.sender,
                loanOrder.loanTokenAddress,
                loanPosition.positionTokenAddressFilled,
                loanPosition.collateralTokenAddressFilled,
                loanPosition.loanTokenAmountFilled,
                loanPosition.positionTokenAmountFilled,
                loanPosition.collateralTokenAmountFilled,
                loanOrder.maintenanceMarginAmount)) {
            return intOrRevert(0,95);
        }

        emit LogPositionTraded(
            loanOrderHash,
            msg.sender,
            loanPosition.positionTokenAddressFilled,
            tradeTokenAddress,
            positionTokenUsedAmount,
            tradeTokenAmount
        );

        // the trade token becomes the new position token
        loanPosition.positionTokenAddressFilled = tradeTokenAddress;
        loanPosition.positionTokenAmountFilled = tradeTokenAmount;

        if (! Oracle_Interface(loanOrder.oracleAddress).didTradePosition(
            loanOrderHash,
            msg.sender, // trader
            tradeTokenAddress,
            tradeTokenAmount,
            gasUsed // initial used gas, collected in modifier
        )) {
            return intOrRevert(0,118);
        }

        return tradeTokenAmount;
    }

    /// @dev Executes a market order trade using the oracle contract specified in the loan referenced by loanOrderHash
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param tradeTokenAddress The address of the token to buy in the trade
    /// @return The amount of token received in the trade.
    function tradePositionWithOracle(
        bytes32 loanOrderHash,
        address tradeTokenAddress)
        external
        nonReentrant
        tracksGas
        returns (uint)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return intOrRevert(0,138);
        }

        if (block.timestamp >= loanOrder.expirationUnixTimestampSec) {
            return intOrRevert(0,142);
        }

        LoanPosition storage loanPosition = loanPositions[loanOrderHash][msg.sender];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return intOrRevert(0,147);
        }

        if (tradeTokenAddress == loanPosition.positionTokenAddressFilled) {
            return intOrRevert(0,151);
        }

        if (DEBUG_MODE) {
            _emitMarginLog(loanOrder, loanPosition);
        }

        // trade token has to equal loan token if loan needs to be liquidated
        if (tradeTokenAddress != loanOrder.loanTokenAddress && Oracle_Interface(loanOrder.oracleAddress).shouldLiquidate(
                loanOrderHash,
                msg.sender,
                loanOrder.loanTokenAddress,
                loanPosition.positionTokenAddressFilled,
                loanPosition.collateralTokenAddressFilled,
                loanPosition.loanTokenAmountFilled,
                loanPosition.positionTokenAmountFilled,
                loanPosition.collateralTokenAmountFilled,
                loanOrder.maintenanceMarginAmount)) {
            return intOrRevert(0,169);
        }

        // check the current token balance of the oracle before sending token to be traded
        uint balanceBeforeTrade = EIP20(loanPosition.positionTokenAddressFilled).balanceOf.gas(4999)(loanOrder.oracleAddress); // Changes to state require at least 5000 gas

        uint tradeTokenAmount = _tradePositionWithOracle(
            loanOrder,
            loanPosition,
            tradeTokenAddress,
            false // isLiquidation
        );

        // It is assumed that all positionToken will be traded, so the remaining token balance of the oracle 
        // shouldn't be greater than the balance before we sent the token to be traded.
        if (balanceBeforeTrade < EIP20(loanPosition.positionTokenAddressFilled).balanceOf.gas(4999)(loanOrder.oracleAddress)) {
            return intOrRevert(0,185);
        }

        if (tradeTokenAmount == 0) {
            return intOrRevert(0,189);
        }

        emit LogPositionTraded(
            loanOrderHash,
            msg.sender,
            loanPosition.positionTokenAddressFilled,
            tradeTokenAddress,
            loanPosition.positionTokenAmountFilled,
            tradeTokenAmount
        );

        // the trade token becomes the new position token
        loanPosition.positionTokenAddressFilled = tradeTokenAddress;
        loanPosition.positionTokenAmountFilled = tradeTokenAmount;

        if (! Oracle_Interface(loanOrder.oracleAddress).didTradePosition(
            loanOrderHash,
            msg.sender, // trader
            tradeTokenAddress,
            tradeTokenAmount,
            gasUsed // initial used gas, collected in modifier
        )) {
            return intOrRevert(0,212);
        }

        return tradeTokenAmount;
    }
}

