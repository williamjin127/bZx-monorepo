/**
 * Copyright 2017–2018, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/math/Math.sol";

import "../proxy/BZxProxiable.sol";
import "../shared/InternalFunctions.sol";


contract BZxOrderHistory is BZxStorage, BZxProxiable, InternalFunctions {
    using SafeMath for uint256;

    constructor() public {}

    function()  
        public
    {
        revert("fallback not allowed");
    }

    function initialize(
        address _target)
        public
        onlyOwner
    {
        targets[bytes4(keccak256("getSingleOrder(bytes32)"))] = _target;
        targets[bytes4(keccak256("getOrdersFillable(uint256,uint256,address)"))] = _target;
        targets[bytes4(keccak256("getOrdersForUser(address,uint256,uint256,address)"))] = _target;
        targets[bytes4(keccak256("getSingleLoan(bytes32,address)"))] = _target;
        targets[bytes4(keccak256("getLoansForLender(address,uint256,bool)"))] = _target;
        targets[bytes4(keccak256("getLoansForTrader(address,uint256,bool)"))] = _target;
        targets[bytes4(keccak256("getActiveLoans(uint256,uint256)"))] = _target;
        targets[bytes4(keccak256("getLoanOrder(bytes32)"))] = _target;
        targets[bytes4(keccak256("getLoanOrderAux(bytes32)"))] = _target;
        targets[bytes4(keccak256("getLoanPosition(uint256)"))] = _target;
    }

    /// @dev Returns a bytestream of a single order.
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @return A concatenated stream of bytes.
    function getSingleOrder(
        bytes32 loanOrderHash)
        public
        view
        returns (bytes)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.loanTokenAddress == address(0)) {
            return;
        }
        LoanOrderAux memory loanOrderAux = orderAux[loanOrderHash];

        // all encoded params will be zero-padded to 32 bytes
        bytes memory data = abi.encode(
            loanOrderAux.makerAddress,
            loanOrder.loanTokenAddress,
            loanOrder.interestTokenAddress,
            loanOrder.collateralTokenAddress,
            loanOrderAux.feeRecipientAddress,
            oracleAddresses[loanOrder.oracleAddress],
            loanOrder.loanTokenAmount,
            loanOrder.interestAmount,
            loanOrder.initialMarginAmount,
            loanOrder.maintenanceMarginAmount,
            loanOrderAux.lenderRelayFee,
            loanOrderAux.traderRelayFee
        );
        return _addExtraOrderData(loanOrder, loanOrderAux, data);
    }

    /// @dev Returns a bytestream of data from orders that are available for taking.
    /// @param start The starting order in the order list to return.
    /// @param count The total amount of orders to return if they exist. Amount returned can be less.
    /// @param oracleFilter Only return orders for a given oracle address.
    /// @return A concatenated stream of bytes.
    function getOrdersFillable(
        uint start,
        uint count,
        address oracleFilter)
        public
        view
        returns (bytes)
    {
        return _getOrdersForAddress(
            address(0),
            start,
            count,
            true, // skipExpired
            oracleFilter
        );
    }

    /// @dev Returns a bytestream of order data for a user.
    /// @param loanParty The address of the maker or taker of the order.
    /// @param start The starting order in the order list to return.
    /// @param count The total amount of orders to return if they exist. Amount returned can be less.
    /// @param oracleFilter Only return orders for a given oracle address.
    /// @return A concatenated stream of bytes.
    function getOrdersForUser(
        address loanParty,
        uint start,
        uint count,
        address oracleFilter)
        public
        view
        returns (bytes)
    {
        return _getOrdersForAddress(
            loanParty,
            start,
            count,
            false, // skipExpired
            oracleFilter
        );
    }

    /// @dev Returns a bytestream of loan data for a trader.
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @param trader The address of the trader/borrower of a loan.
    /// @return A concatenated stream of bytes.
    function getSingleLoan(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (bytes)
    {
        LoanPosition memory loanPosition = loanPositions[loanPositionsIds[loanOrderHash][trader]];
        if (loanPosition.loanTokenAmountFilled == 0) {
            return;
        }

        // all encoded params will be zero-padded to 32 bytes
        bytes memory data = abi.encode(
            orderLender[loanOrderHash],
            loanPosition.trader,
            loanPosition.collateralTokenAddressFilled,
            loanPosition.positionTokenAddressFilled,
            loanPosition.loanTokenAmountFilled,
            loanPosition.collateralTokenAmountFilled,
            loanPosition.positionTokenAmountFilled,
            loanPosition.loanStartUnixTimestampSec,
            loanPosition.loanEndUnixTimestampSec,
            loanPosition.active
        );
        return _addExtraLoanData(
            loanOrderHash,
            loanPosition,
            data);
    }

    /// @dev Returns a bytestream of loan data for a lender.
    /// @param loanParty The address of the lender in the loan.
    /// @param count The total amount of loans to return if they exist. Amount returned can be less.
    /// @param activeOnly A boolean indicating if inactive/expired loans should be excluded.
    /// @return A concatenated stream of bytes.
    function getLoansForLender(
        address loanParty,
        uint count,
        bool activeOnly)
        public
        view
        returns (bytes)
    {
        return _getLoanPositions(
            loanParty,
            count,
            activeOnly,
            true // forLender
        );
    }

    /// @dev Returns a bytestream of loan data for a trader.
    /// @param loanParty The address of the trader in the loan.
    /// @param count The total amount of loans to return if they exist. Amount returned can be less.
    /// @param activeOnly A boolean indicating if inactive/expired loans should be excluded.
    /// @return A concatenated stream of bytes.
    function getLoansForTrader(
        address loanParty,
        uint count,
        bool activeOnly)
        public
        view
        returns (bytes)
    {
        return _getLoanPositions(
            loanParty,
            count,
            activeOnly,
            false // forLender
        );
    }

    /// @dev Returns a bytestream of active loans.
    /// @param start The starting loan in the loan list to return.
    /// @param count The total amount of loans to return if they exist. Amount returned can be less.
    /// @return A concatenated stream of PositionRef(loanOrderHash, trader) bytes.
    function getActiveLoans(
        uint start,
        uint count)
        public
        view
        returns (bytes)
    {
        uint end = Math.min256(positionList.length, start.add(count));
        if (end == 0 || start >= end) {
            return;
        }

        // all encoded params will be zero-padded to 32 bytes
        bytes memory data;

        for (uint j=0; j < end-start; j++) {
            PositionRef memory positionRef = positionList[j+start];
            LoanPosition memory loanPosition = loanPositions[positionRef.positionId];

            bytes memory tmpBytes = abi.encode(
                positionRef.loanOrderHash,
                loanPosition.trader,
                loanPosition.loanEndUnixTimestampSec
            );
            if (j == 0) {
                data = tmpBytes;
            } else {
                data = abi.encodePacked(data, tmpBytes);
            }
        }

        return data;
    }

    /// @dev Returns a LoanOrder object.
    /// @param loanOrderHash A unique hash representing the loan order.
    function getLoanOrder(
        bytes32 loanOrderHash)
        public
        view
        returns (LoanOrder)
    {
        return orders[loanOrderHash];
    }

    /// @dev Returns a LoanOrderAux object.
    /// @param loanOrderHash A unique hash representing the loan order.
    function getLoanOrderAux(
        bytes32 loanOrderHash)
        public
        view
        returns (LoanOrderAux)
    {
        return orderAux[loanOrderHash];
    }

    /// @dev Returns a LoanPosition object.
    /// @param positionId A unqiue id representing the loan position.
    function getLoanPosition(
        uint positionId)
        public
        view
        returns (LoanPosition)
    {
        return loanPositions[positionId];
    }

    /*
    * Internal functions
    */

    function _getOrdersForAddress(
        address addr,
        uint start,
        uint count,
        bool skipExpired,
        address oracleFilter)
        internal
        view
        returns (bytes)
    {
        uint end = Math.min256(orderList[addr].length, start.add(count));
        if (end == 0 || start >= end) {
            return;
        }

        // all encoded params will be zero-padded to 32 bytes
        bytes memory data;

        end = end-start;
        for (uint j=0; j < end; j++) {
            LoanOrder memory loanOrder = orders[orderList[addr][j+start]];

            LoanOrderAux memory loanOrderAux = orderAux[orderList[addr][j+start]];

            if (skipExpired && loanOrderAux.expirationUnixTimestampSec > 0 && block.timestamp >= loanOrderAux.expirationUnixTimestampSec) {
                if (end < orderList[addr].length)
                    end++;

                continue;
            }

            if (oracleFilter != address(0) && oracleFilter != oracleAddresses[loanOrder.oracleAddress]) {
                if (end < orderList[addr].length)
                    end++;

                continue;
            }

            bytes memory tmpBytes = abi.encode(
                loanOrderAux.makerAddress,
                loanOrder.loanTokenAddress,
                loanOrder.interestTokenAddress,
                loanOrder.collateralTokenAddress,
                loanOrderAux.feeRecipientAddress,
                oracleAddresses[loanOrder.oracleAddress],
                loanOrder.loanTokenAmount,
                loanOrder.interestAmount,
                loanOrder.initialMarginAmount,
                loanOrder.maintenanceMarginAmount,
                loanOrderAux.lenderRelayFee,
                loanOrderAux.traderRelayFee
            );
            tmpBytes = _addExtraOrderData(loanOrder, loanOrderAux, tmpBytes);
            if (j == 0) {
                data = tmpBytes;
            } else {
                data = abi.encodePacked(data, tmpBytes);
            }
        }

        return data;
    }

    function _addExtraOrderData(
        LoanOrder loanOrder,
        LoanOrderAux loanOrderAux,
        bytes data)
        internal
        view
        returns (bytes)
    {
        bytes memory tmpBytes = abi.encode(
            loanOrder.maxDurationUnixTimestampSec,
            loanOrderAux.expirationUnixTimestampSec,
            loanOrder.loanOrderHash,
            orderLender[loanOrder.loanOrderHash],
            orderFilledAmounts[loanOrder.loanOrderHash],
            orderCancelledAmounts[loanOrder.loanOrderHash],
            orderPositionList[loanOrder.loanOrderHash].length, // trader count
            orderPositionList[loanOrder.loanOrderHash].length > 0 ? loanPositions[orderPositionList[loanOrder.loanOrderHash][0]].loanStartUnixTimestampSec : 0,
            loanOrderAux.takerAddress,
            loanOrderAux.tradeTokenToFill,
            loanOrderAux.withdrawOnOpen
        );
        return abi.encodePacked(data, tmpBytes);
    }

    function _getLoanPositions(
        address loanParty,
        uint count,
        bool activeOnly,
        bool forLender)
        internal
        view
        returns (bytes)
    {
        // all encoded params will be zero-padded to 32 bytes
        bytes memory data;

        uint itemCount = 0;
        for (uint j=orderList[loanParty].length; j > 0; j--) {
            bytes32 loanOrderHash = orderList[loanParty][j-1];
            uint[] memory positionIds = orderPositionList[loanOrderHash];

            if (forLender && loanParty != orderLender[loanOrderHash]) {
                continue;
            }

            for (uint i=positionIds.length; i > 0; i--) {
                LoanPosition memory loanPosition = loanPositions[positionIds[i-1]];

                if (activeOnly && (!loanPosition.active || (loanPosition.loanEndUnixTimestampSec > 0 && block.timestamp >= loanPosition.loanEndUnixTimestampSec))) {
                    continue;
                }

                if (!forLender && loanParty != loanPosition.trader) {
                    continue;
                }

                bytes memory tmpBytes = abi.encode(
                    orderLender[loanOrderHash],
                    loanPosition.trader,
                    loanPosition.collateralTokenAddressFilled,
                    loanPosition.positionTokenAddressFilled,
                    loanPosition.loanTokenAmountFilled,
                    loanPosition.collateralTokenAmountFilled,
                    loanPosition.positionTokenAmountFilled,
                    loanPosition.loanStartUnixTimestampSec,
                    loanPosition.loanEndUnixTimestampSec,
                    loanPosition.active
                );
                tmpBytes = _addExtraLoanData(
                    orderList[loanParty][j-1],
                    loanPosition,
                    tmpBytes);

                if (itemCount == 0) {
                    data = tmpBytes;
                } else {
                    data = abi.encodePacked(data, tmpBytes);
                }
                itemCount++;

                if (itemCount == count) {
                    break;
                }
            }
            if (itemCount == count) {
                break;
            }
        }

        return data;
    }

    function _addExtraLoanData(
        bytes32 loanOrderHash,
        LoanPosition loanPosition,
        bytes data)
        internal
        view
        returns (bytes)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];

        InterestData memory interestData = _getInterestData(loanOrder, loanPosition);

        bytes memory tmpBytes = abi.encode(
            loanOrderHash,
            loanOrder.loanTokenAddress,
            interestData.interestTokenAddress,
            interestData.interestTotalAccrued,
            interestData.interestPaidSoFar,
            interestData.interestLastPaidDate
        );
        return abi.encodePacked(data, tmpBytes);
    }
}
