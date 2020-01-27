/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.3;
pragma experimental ABIEncoderV2;

import "../openzeppelin-solidity/Math.sol";
import "../proxy/BZxProxiable.sol";

import "../shared/MiscFunctions.sol";

import "../tokens/EIP20.sol";

contract iTokens_loanManagementFunctions2 is BZxStorage, BZxProxiable, MiscFunctions {
    using SafeMath for uint256;

    struct BasicLoanData {
        bytes32 loanOrderHash;
        address loanTokenAddress;
        address collateralTokenAddress;
        uint256 loanTokenAmountFilled;
        uint256 positionTokenAmountFilled;
        uint256 collateralTokenAmountFilled;
        uint256 interestOwedPerDay;
        uint256 interestDepositRemaining;
        uint256 initialMarginAmount;
        uint256 maintenanceMarginAmount;
        uint256 currentMarginAmount;
        uint256 maxDurationUnixTimestampSec;
        uint256 loanEndUnixTimestampSec;
    }


    constructor() public {}

    function()
        external
    {
        revert("fallback not allowed");
    }

    function initialize(
        address _target)
        public
        onlyOwner
    {
        targets[bytes4(keccak256("extendLoanByInterest(bytes32,address,address,uint256,bool)"))] = _target;
        targets[bytes4(keccak256("getBasicLoansData(address,uint256,uint256)"))] = _target;
        targets[bytes4(keccak256("getBasicLoanData(bytes32,address)"))] = _target;
    }

    function extendLoanByInterest(
        bytes32 loanOrderHash,
        address borrower,
        address payer,
        uint256 depositAmount,
        bool useCollateral)
        external
        payable
        tracksGas
        returns (uint256 secondsExtended)
    {
        // only callable by borrower or by iTokens and supporting contracts
        require(
            allowedValidators[address(0)][msg.sender] ||
            (msg.sender == borrower && msg.sender == payer),
            "unauthorized"
        );

        require(depositAmount != 0, "depositAmount is 0");

        LoanPosition storage loanPosition = loanPositions[loanPositionsIds[loanOrderHash][borrower]];
        LoanOrder memory loanOrder = orders[loanOrderHash];
        require(loanPosition.active &&
            loanPosition.loanTokenAmountFilled != 0 &&
            loanOrder.loanTokenAddress != address(0) &&
            block.timestamp < loanPosition.loanEndUnixTimestampSec,
            "loan not open"
        );

        require(loanOrder.maxDurationUnixTimestampSec == 0, "indefinite-term only");
        require(msg.value == 0 || (!useCollateral && loanOrder.interestTokenAddress == wethContract), "wrong asset sent");

        address lender = orderLender[loanOrder.loanOrderHash];
        LenderInterest storage oracleInterest = lenderOracleInterest[lender][loanOrder.oracleAddress][loanOrder.interestTokenAddress];
        TraderInterest storage traderInterest = traderLoanInterest[loanPosition.positionId];

        // update lender interest
        _payInterestForOracle(
            oracleInterest,
            lender,
            loanOrder.oracleAddress,
            loanOrder.interestTokenAddress,
            true // sendToOracle
        );

        if (traderInterest.interestUpdatedDate != 0 && traderInterest.interestOwedPerDay != 0) {
            traderInterest.interestPaid = block.timestamp
                .sub(traderInterest.interestUpdatedDate)
                .mul(traderInterest.interestOwedPerDay)
                .div(86400)
                .add(traderInterest.interestPaid);
        }

        // deposit interest
        if (useCollateral) {
            address oracle = oracleAddresses[loanOrder.oracleAddress];

            uint256 sourceTokenAmountUsed;
            if (loanPosition.collateralTokenAddressFilled == loanOrder.interestTokenAddress) {
                require (loanPosition.collateralTokenAmountFilled >= depositAmount, "can't fill interest");
                sourceTokenAmountUsed = depositAmount;
            } else {
                require (BZxVault(vaultContract).withdrawToken(
                    loanPosition.collateralTokenAddressFilled,
                    oracle,
                    loanPosition.collateralTokenAmountFilled),
                    "withdraw failed"
                );
                uint256 destTokenAmountReceived;
                (destTokenAmountReceived, sourceTokenAmountUsed) = OracleInterface(oracle).trade(
                    loanPosition.collateralTokenAddressFilled,
                    loanOrder.interestTokenAddress,
                    loanPosition.collateralTokenAmountFilled,
                    depositAmount
                );
                require (destTokenAmountReceived >= depositAmount && destTokenAmountReceived != MAX_UINT, "can't fill interest");
            }

            loanPosition.collateralTokenAmountFilled = loanPosition.collateralTokenAmountFilled
                .sub(sourceTokenAmountUsed);

            // ensure the loan is still healthy
            require (!OracleInterface(oracle)
                .shouldLiquidate(loanOrder, loanPosition),
                "unhealthy"
            );
        } else {
            if (msg.value != 0) {
                require(msg.value >= depositAmount, "insufficient ether");

                // deposit()
                (bool success,) = wethContract.call.value(depositAmount)("0xd0e30db0");
                if (success) {
                    success = EIP20(wethContract).transfer(
                        vaultContract,
                        depositAmount
                    );
                }
                if (success && msg.value > depositAmount) {
                    (success,) = msg.sender.call.value(msg.value - depositAmount)("");
                }
                require(success, "deposit failed");
            } else {
                require(BZxVault(vaultContract).depositToken(
                    loanOrder.interestTokenAddress,
                    payer,
                    depositAmount
                ), "deposit failed");
            }
        }

        secondsExtended = depositAmount
            .mul(86400)
            .div(traderInterest.interestOwedPerDay);

        loanPosition.loanEndUnixTimestampSec = loanPosition.loanEndUnixTimestampSec
            .add(secondsExtended);

        uint256 maxDuration = loanPosition.loanEndUnixTimestampSec
            .sub(block.timestamp);

        // loan term has to at least be 24 hours
        require(maxDuration >= 86400, "loan too short");

        traderInterest.interestDepositTotal = traderInterest.interestDepositTotal.add(depositAmount);
        traderInterest.interestUpdatedDate = block.timestamp;

        tokenInterestOwed[lender][loanOrder.interestTokenAddress] = tokenInterestOwed[lender][loanOrder.interestTokenAddress].add(depositAmount);
    }

    // Only returns data for loans that are active
    // loanType 0: all loans
    // loanType 1: margin trade loans
    // loanType 2: non-margin trade loans
    function getBasicLoansData(
        address borrower,
        uint256 count,
        uint256 loanType)
        public
        view
        returns (BasicLoanData[] memory loans)
    {
        loans = new BasicLoanData[](count);
        uint256 itemCount;
        address oracle;
        OracleInterface oracleRef;
        for (uint256 j=orderList[borrower].length; j > 0; j--) {
            bytes32 loanOrderHash = orderList[borrower][j-1];
            LoanOrder memory loanOrder = orders[loanOrderHash];
            uint256[] memory positionIds = orderPositionList[loanOrderHash];

            // save gas by not doing repetitive storage lookups
            if (oracle != loanOrder.oracleAddress) {
                oracleRef = OracleInterface(oracleAddresses[loanOrder.oracleAddress]);
            }

            for (uint256 i=positionIds.length; i > 0; i--) {
                if (itemCount == count) {
                    return loans;
                }

                uint256 positionId = positionIds[i-1];
                LoanPosition memory loanPosition = loanPositions[positionId];

                if (loanType != 0) {
                    if (!(
                        (loanType == 1 && loanPosition.positionTokenAddressFilled != loanOrder.loanTokenAddress) ||
                        (loanType == 2 && loanPosition.positionTokenAddressFilled == loanOrder.loanTokenAddress)
                    )) {
                        continue;
                    }
                }

                if (!loanPosition.active) {
                    continue;
                }

                if (borrower != loanPosition.trader) {
                    continue;
                }

                TraderInterest memory traderInterest = traderLoanInterest[positionId];

                loans[itemCount] = BasicLoanData({
                    loanOrderHash: loanOrderHash,
                    loanTokenAddress: loanOrder.loanTokenAddress,
                    collateralTokenAddress: loanPosition.collateralTokenAddressFilled,
                    loanTokenAmountFilled: loanPosition.loanTokenAmountFilled,
                    positionTokenAmountFilled: loanPosition.positionTokenAmountFilled,
                    collateralTokenAmountFilled: loanPosition.collateralTokenAmountFilled,
                    interestOwedPerDay: traderInterest.interestOwedPerDay,
                    interestDepositRemaining: loanPosition.loanEndUnixTimestampSec.sub(block.timestamp).mul(traderInterest.interestOwedPerDay).div(86400),
                    initialMarginAmount: loanOrder.initialMarginAmount,
                    maintenanceMarginAmount: loanOrder.maintenanceMarginAmount,
                    currentMarginAmount: oracleRef.getCurrentMarginAmount(
                        loanOrder.loanTokenAddress,
                        loanPosition.positionTokenAddressFilled,
                        loanPosition.collateralTokenAddressFilled,
                        loanPosition.loanTokenAmountFilled,
                        loanPosition.positionTokenAmountFilled,
                        loanPosition.collateralTokenAmountFilled
                    ),
                    maxDurationUnixTimestampSec: loanOrder.maxDurationUnixTimestampSec,
                    loanEndUnixTimestampSec: loanPosition.loanEndUnixTimestampSec
                });

                itemCount++;
            }
        }

        if (itemCount < count) {
            assembly {
                mstore(loans, itemCount)
            }
        }
    }

    function getBasicLoanData(
        bytes32 loanOrderHash,
        address borrower)
        public
        view
        returns (BasicLoanData memory loanData)
    {
        uint256 positionId = loanPositionsIds[loanOrderHash][borrower];
        require(positionId != 0, "invalid loan");

        LoanOrder memory loanOrder = orders[loanOrderHash];
        LoanPosition storage loanPosition = loanPositions[positionId];
        require(borrower == loanPosition.trader, "invalid loan");

        OracleInterface oracleRef = OracleInterface(oracleAddresses[loanOrder.oracleAddress]);

        TraderInterest memory traderInterest = traderLoanInterest[positionId];

        loanData = BasicLoanData({
            loanOrderHash: loanOrderHash,
            loanTokenAddress: loanOrder.loanTokenAddress,
            collateralTokenAddress: loanPosition.collateralTokenAddressFilled,
            loanTokenAmountFilled: loanPosition.loanTokenAmountFilled,
            positionTokenAmountFilled: loanPosition.positionTokenAmountFilled,
            collateralTokenAmountFilled: loanPosition.collateralTokenAmountFilled,
            interestOwedPerDay: traderInterest.interestOwedPerDay,
            interestDepositRemaining: loanPosition.loanEndUnixTimestampSec.sub(block.timestamp).mul(traderInterest.interestOwedPerDay).div(86400),
            initialMarginAmount: loanOrder.initialMarginAmount,
            maintenanceMarginAmount: loanOrder.maintenanceMarginAmount,
            currentMarginAmount: oracleRef.getCurrentMarginAmount(
                loanOrder.loanTokenAddress,
                loanPosition.positionTokenAddressFilled,
                loanPosition.collateralTokenAddressFilled,
                loanPosition.loanTokenAmountFilled,
                loanPosition.positionTokenAmountFilled,
                loanPosition.collateralTokenAmountFilled
            ),
            maxDurationUnixTimestampSec: loanOrder.maxDurationUnixTimestampSec,
            loanEndUnixTimestampSec: loanPosition.loanEndUnixTimestampSec
        });
    }
}
