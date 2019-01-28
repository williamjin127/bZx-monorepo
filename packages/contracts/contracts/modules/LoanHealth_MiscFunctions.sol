/**
 * Copyright 2017–2018, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "../openzeppelin-solidity/Math.sol";

import "../proxy/BZxProxiable.sol";
import "../shared/MiscFunctions.sol";

import "../BZxVault.sol";
import "../oracle/OracleInterface.sol";


contract LoanHealth_MiscFunctions is BZxStorage, BZxProxiable, MiscFunctions {
    using SafeMath for uint256;

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
        targets[bytes4(keccak256("liquidatePosition(bytes32,address)"))] = _target;
        targets[bytes4(keccak256("closeLoanPartially(bytes32,uint256)"))] = _target;
        targets[bytes4(keccak256("closeLoan(bytes32)"))] = _target;
        targets[bytes4(keccak256("forceCloseLoan(bytes32,address)"))] = _target;
        targets[bytes4(keccak256("shouldLiquidate(bytes32,address)"))] = _target;
    }

    /// @dev Checks that a position meets the conditions for liquidation, then closes the position and loan.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The trader of the position
    /// @return True on success
    function liquidatePosition(
        bytes32 loanOrderHash,
        address trader)
        external
        nonReentrant
        tracksGas
        returns (bool)
    {
        if (trader == msg.sender) {
            return _closeLoan(
                loanOrderHash,
                gasUsed // initial used gas, collected in modifier
            );
        }

        LoanPosition storage loanPosition = loanPositions[loanPositionsIds[loanOrderHash][trader]];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            revert("BZxLoanHealth::liquidatePosition: loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active");
        }

        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.loanTokenAddress == address(0)) {
            revert("BZxLoanHealth::liquidatePosition: loanOrder.loanTokenAddress == address(0)");
        }

        // If the position token is not the loan token, then we need to buy back the loan token 
        // prior to closing the loan. Liquidation checks will be run in _tradePositionWithOracle.
        if (loanPosition.positionTokenAddressFilled != loanOrder.loanTokenAddress) {
            (uint256 loanTokenAmount, uint256 positionTokenAmountUsed) = _tradePositionWithOracle(
                loanOrder,
                loanPosition,
                loanOrder.loanTokenAddress, // tradeTokenAddress
                MAX_UINT,
                !DEBUG_MODE, // isLiquidation
                false // ensureHealthy
            );

            if (positionTokenAmountUsed < loanPosition.positionTokenAmountFilled) {
                // left over sourceToken needs to be dispursed
                if (! BZxVault(vaultContract).withdrawToken(
                    loanPosition.positionTokenAddressFilled,
                    loanTokenAmount >= loanPosition.loanTokenAmountFilled ? loanPosition.trader : orderLender[loanOrderHash],
                    loanPosition.positionTokenAmountFilled.sub(positionTokenAmountUsed)
                )) {
                    revert("BZxLoanHealth::liquidatePosition: BZxVault.withdrawToken excess failed");
                }
            }

            // the loan token becomes the new position token
            loanPosition.positionTokenAddressFilled = loanOrder.loanTokenAddress;
            loanPosition.positionTokenAmountFilled = loanTokenAmount;
        } else {
            // verify liquidation checks before proceeding to close the loan
            if (!DEBUG_MODE && block.timestamp < loanPosition.loanEndUnixTimestampSec) { // checks for non-expired loan
                if (! OracleInterface(oracleAddresses[loanOrder.oracleAddress]).shouldLiquidate(
                        loanOrder,
                        loanPosition)) {
                    revert("BZxLoanHealth::liquidatePosition: liquidation not allowed");
                }
            }
        }

        require(_finalizeLoan(
            loanOrder,
            loanPosition, // needs to be storage
            true, // isLiquidation
            gasUsed // initial used gas, collected in modifier
        ),"BZxLoanHealth::liquidatePosition: _finalizeLoan failed");

        return true;
    }

    /// @dev Called by the trader to close part of their loan early.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param closeAmount The amount of the loan token to return to the lender
    /// @return True on success
    function closeLoanPartially(
        bytes32 loanOrderHash,
        uint256 closeAmount)
        external
        nonReentrant
        tracksGas
        returns (bool)
    { 
        return _closeLoanPartially(
            loanOrderHash,
            closeAmount,
            gasUsed // initial used gas, collected in modifier
        );
    }

    /// @dev Called by the trader to close their loan early.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @return True on success
    function closeLoan(
        bytes32 loanOrderHash)
        external
        nonReentrant
        tracksGas
        returns (bool)
    { 
        return _closeLoan(
            loanOrderHash,
            gasUsed // initial used gas, collected in modifier
        );
    }

    /// @dev Called by an admin to force close a loan early and return assets to the lender and trader as is.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The trader of the position
    /// @return True on success
    function forceCloseLoan(
        bytes32 loanOrderHash,
        address trader)
        public
        onlyOwner
        tracksGas
        returns (bool)
    {
        uint256 positionId = loanPositionsIds[loanOrderHash][trader];

        LoanPosition storage loanPosition = loanPositions[positionId];
        require(loanPosition.loanTokenAmountFilled != 0 && loanPosition.active);

        LoanOrder memory loanOrder = orders[loanOrderHash];
        require(loanOrder.loanTokenAddress != address(0));

        if (loanOrder.interestAmount > 0) {
            LenderInterest storage oracleInterest = lenderOracleInterest[orderLender[loanOrderHash]][loanOrder.oracleAddress][loanOrder.interestTokenAddress];
            LenderInterest storage lenderInterest = lenderOrderInterest[loanOrderHash];
            TraderInterest storage traderInterest = traderLoanInterest[positionId];

            // update lender interest
            uint256 lenderInterestOwedNow = _payInterestForOrder(loanOrder, oracleInterest, lenderInterest, false);
            if (lenderInterestOwedNow > 0) {
                require(BZxVault(vaultContract).withdrawToken(
                    loanOrder.interestTokenAddress,
                    orderLender[loanOrder.loanOrderHash],
                    lenderInterestOwedNow
                ));
            }
            lenderInterest.interestOwedPerDay = lenderInterest.interestOwedPerDay.sub(traderInterest.interestOwedPerDay);
            oracleInterest.interestOwedPerDay = oracleInterest.interestOwedPerDay.sub(traderInterest.interestOwedPerDay);

            // update trader interest
            uint256 interestTime = block.timestamp;
            if (interestTime > loanPosition.loanEndUnixTimestampSec) {
                interestTime = loanPosition.loanEndUnixTimestampSec;
            }
            uint256 totalInterestToRefund = loanPosition.loanEndUnixTimestampSec.sub(interestTime).mul(traderInterest.interestOwedPerDay).div(86400);
            if (traderInterest.interestUpdatedDate > 0 && traderInterest.interestOwedPerDay > 0) {
                traderInterest.interestPaid = traderInterest.interestPaid.add(
                    interestTime.sub(traderInterest.interestUpdatedDate).mul(traderInterest.interestOwedPerDay).div(86400)
                );
            }
            traderInterest.interestUpdatedDate = interestTime;
            traderInterest.interestOwedPerDay = 0;
            traderInterest.interestDepositTotal = 0;

            if (totalInterestToRefund > 0) {
                require(BZxVault(vaultContract).withdrawToken(
                    loanOrder.interestTokenAddress,
                    loanPosition.trader,
                    totalInterestToRefund
                ));

                tokenInterestOwed[orderLender[loanOrder.loanOrderHash]][loanOrder.interestTokenAddress] = totalInterestToRefund < tokenInterestOwed[orderLender[loanOrder.loanOrderHash]][loanOrder.interestTokenAddress] ?
                    tokenInterestOwed[orderLender[loanOrder.loanOrderHash]][loanOrder.interestTokenAddress].sub(totalInterestToRefund) :
                    0;
            }
        }

        if (loanPosition.collateralTokenAmountFilled > 0) {
            require(BZxVault(vaultContract).withdrawToken(
                loanPosition.collateralTokenAddressFilled,
                loanPosition.trader,
                loanPosition.collateralTokenAmountFilled
            ));
        }

        if (loanPosition.positionTokenAmountFilled > 0) {
            require(BZxVault(vaultContract).withdrawToken(
                loanPosition.positionTokenAddressFilled,
                orderLender[loanOrderHash],
                loanPosition.positionTokenAmountFilled
            ));
        }

        uint256 closeAmount = loanPosition.loanTokenAmountFilled;
        
        loanPosition.loanTokenAmountFilled = 0;
        //loanPosition.loanTokenAmountUsed = 0; <- not used yet
        loanPosition.active = false;
        _removePosition(
            loanOrderHash,
            loanPosition.trader);

        emit LogLoanClosed(
            orderLender[loanOrderHash],
            loanPosition.trader,
            msg.sender, // loanCloser
            false, // isLiquidation
            loanOrder.loanOrderHash,
            loanPosition.positionId
        );

        require(OracleInterface(oracleAddresses[loanOrder.oracleAddress]).didCloseLoan(
            loanOrder,
            loanPosition,
            msg.sender, // loanCloser
            closeAmount,
            false, // isLiquidation
            gasUsed
        ));

        return true;
    }

    /*
    * Constant public functions
    */
    /// @dev Checks the conditions for liquidation with the oracle
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The trader of the position
    /// @return True if liquidation should occur, false otherwise
    function shouldLiquidate(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (bool)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.loanTokenAddress == address(0)) {
            return false;
        }

        LoanPosition memory loanPosition = loanPositions[loanPositionsIds[loanOrderHash][trader]];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return false;
        }

        if (block.timestamp >= loanPosition.loanEndUnixTimestampSec) {
            return true; // expired loan
        }

        return OracleInterface(oracleAddresses[loanOrder.oracleAddress]).shouldLiquidate(
            loanOrder,
            loanPosition);
    }


    /*
    * Internal functions
    */

    function _closeLoanPartially(
        bytes32 loanOrderHash,
        uint256 closeAmount,
        uint256 gasUsed)
        internal
        returns (bool)
    {
        if (closeAmount == 0) {
            return false;
        }
        
        uint256 positionId = loanPositionsIds[loanOrderHash][msg.sender];
        LoanPosition storage loanPosition = loanPositions[positionId];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            revert("BZxLoanHealth::_closeLoanPartially: loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active");
        }

        if (closeAmount >= loanPosition.loanTokenAmountFilled) {
            return _closeLoan(
                loanOrderHash,
                gasUsed // initial used gas, collected in modifier
            );
        }

        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.loanTokenAddress == address(0)) {
            revert("BZxLoanHealth::_closeLoanPartially: loanOrder.loanTokenAddress == address(0)");
        }

        // pay lender interest so far, and do partial interest refund to trader
        if (loanOrder.interestAmount > 0) {
            LenderInterest storage oracleInterest = lenderOracleInterest[orderLender[loanOrderHash]][loanOrder.oracleAddress][loanOrder.interestTokenAddress];
            LenderInterest storage lenderInterest = lenderOrderInterest[loanOrderHash];
            TraderInterest storage traderInterest = traderLoanInterest[positionId];

            // update lender interest
            _payInterestForOrder(loanOrder, oracleInterest, lenderInterest, true);
            uint256 owedPerDayRefund = _safeGetPartialAmountFloor(
                closeAmount,
                loanPosition.loanTokenAmountFilled,
                traderInterest.interestOwedPerDay
            );

            lenderInterest.interestOwedPerDay = lenderInterest.interestOwedPerDay.sub(owedPerDayRefund);
            oracleInterest.interestOwedPerDay = oracleInterest.interestOwedPerDay.sub(owedPerDayRefund);

            // update trader interest
            uint256 interestTime = block.timestamp;
            if (interestTime > loanPosition.loanEndUnixTimestampSec) {
                interestTime = loanPosition.loanEndUnixTimestampSec;
            }
            uint256 totalInterestToRefund = loanPosition.loanEndUnixTimestampSec.sub(interestTime).mul(owedPerDayRefund).div(86400);
            if (traderInterest.interestUpdatedDate > 0 && traderInterest.interestOwedPerDay > 0) {
                traderInterest.interestPaid = traderInterest.interestPaid.add(
                    interestTime.sub(traderInterest.interestUpdatedDate).mul(traderInterest.interestOwedPerDay).div(86400)
                );
            }
            traderInterest.interestUpdatedDate = interestTime;
            traderInterest.interestOwedPerDay = traderInterest.interestOwedPerDay.sub(owedPerDayRefund);
            traderInterest.interestDepositTotal = traderInterest.interestDepositTotal.sub(totalInterestToRefund);

            if (totalInterestToRefund > 0) {
                if (! BZxVault(vaultContract).withdrawToken(
                    loanOrder.interestTokenAddress,
                    loanPosition.trader,
                    totalInterestToRefund
                )) {
                    revert("BZxLoanHealth::_closeLoanPartially: BZxVault.withdrawToken interest failed");
                }

                tokenInterestOwed[orderLender[loanOrder.loanOrderHash]][loanOrder.interestTokenAddress] = totalInterestToRefund < tokenInterestOwed[orderLender[loanOrder.loanOrderHash]][loanOrder.interestTokenAddress] ?
                    tokenInterestOwed[orderLender[loanOrder.loanOrderHash]][loanOrder.interestTokenAddress].sub(totalInterestToRefund) :
                    0;
            }
        }

        uint256 marginAmountBeforeClose = OracleInterface(oracleAddresses[loanOrder.oracleAddress]).getCurrentMarginAmount(
            loanOrder.loanTokenAddress,
            loanPosition.positionTokenAddressFilled,
            loanPosition.collateralTokenAddressFilled,
            loanPosition.loanTokenAmountFilled,
            loanPosition.positionTokenAmountFilled,
            loanPosition.collateralTokenAmountFilled);

        if (loanPosition.positionTokenAddressFilled != loanOrder.loanTokenAddress) {
            (uint256 loanTokenAmountClosed, uint256 positionTokenAmountUsed) = _tradePositionWithOracle(
                loanOrder,
                loanPosition,
                loanOrder.loanTokenAddress, // tradeTokenAddress
                closeAmount,
                false, // isLiquidation
                false // ensureHealthy
            );

            if (loanTokenAmountClosed < closeAmount) {
                revert("BZxLoanHealth::_closeLoanPartially: loanTokenAmountClosed < closeAmount");
            }

            if (loanPosition.positionTokenAmountFilled < positionTokenAmountUsed) {
                revert("BZxLoanHealth::_closeLoanPartially: positionTokenAmountFilled < positionTokenAmountUsed");
            }

            loanPosition.positionTokenAmountFilled = loanPosition.positionTokenAmountFilled.sub(positionTokenAmountUsed);
        } else {
            if (loanPosition.positionTokenAmountFilled < closeAmount) {
                revert("BZxLoanHealth::_closeLoanPartially: positionTokenAmountFilled < closeAmount");
            }

            loanPosition.positionTokenAmountFilled = loanPosition.positionTokenAmountFilled.sub(closeAmount);
        }
        
        (,,uint256 loanToCollateralTokenAmount) = OracleInterface(oracleAddresses[loanOrder.oracleAddress]).getTradeData(
            loanOrder.loanTokenAddress,
            loanPosition.collateralTokenAddressFilled,
            closeAmount);
        uint256 collateralCloseAmount = loanToCollateralTokenAmount.mul(marginAmountBeforeClose).div(10**20);
        if (collateralCloseAmount > 0) {
            // send excess collateral token back to the trader
            if (! BZxVault(vaultContract).withdrawToken(
                loanPosition.collateralTokenAddressFilled,
                msg.sender,
                collateralCloseAmount
            )) {
                revert("BZxLoanHealth::_closeLoanPartially: BZxVault.withdrawToken collateral failed");
            }

            loanPosition.collateralTokenAmountFilled = loanPosition.collateralTokenAmountFilled.sub(collateralCloseAmount);
        }

        // send closed token back to the lender
        if (! BZxVault(vaultContract).withdrawToken(
            loanOrder.loanTokenAddress,
            orderLender[loanOrderHash],
            closeAmount
        )) {
            revert("BZxLoanHealth::_closeLoanPartially: BZxVault.withdrawToken loan failed");
        }

        loanPosition.loanTokenAmountFilled = loanPosition.loanTokenAmountFilled.sub(closeAmount);
        //loanPosition.loanTokenAmountUsed = loanPosition.loanTokenAmountUsed.sub(closeAmount); <- not used yet

        if (orderAux[loanOrderHash].expirationUnixTimestampSec == 0 || block.timestamp < orderAux[loanOrderHash].expirationUnixTimestampSec) {
            // since order is not expired, we make the closeAmount available for borrowing again
            orderFilledAmounts[loanOrderHash] = orderFilledAmounts[loanOrderHash].sub(closeAmount);

            if (!orderListIndex[loanOrderHash][address(0)].isSet && loanOrder.loanTokenAmount.sub(_getUnavailableLoanTokenAmount(loanOrderHash)) > 0) {
                // record of fillable (non-expired/unfilled) orders
                orderList[address(0)].push(loanOrderHash);
                orderListIndex[loanOrderHash][address(0)] = ListIndex({
                    index: orderList[address(0)].length-1,
                    isSet: true
                });
            }
        }

        if (! OracleInterface(oracleAddresses[loanOrder.oracleAddress]).didCloseLoan(
            loanOrder,
            loanPosition,
            msg.sender, // loanCloser
            closeAmount,
            false, // isLiquidation
            gasUsed
        )) {
            revert("BZxLoanHealth::_closeLoanPartially: OracleInterface.didCloseLoan failed");
        }

        return true;
    }

    function _closeLoan(
        bytes32 loanOrderHash,
        uint256 gasUsed)
        internal
        returns (bool)
    {
        LoanPosition storage loanPosition = loanPositions[loanPositionsIds[loanOrderHash][msg.sender]];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            revert("BZxLoanHealth::_closeLoan: loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active");
        }

        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.loanTokenAddress == address(0)) {
            revert("BZxLoanHealth::_closeLoan: loanOrder.loanTokenAddress == address(0)");
        }

        // If the position token is not the loan token, then we need to buy back the loan token prior to closing the loan.
        if (loanPosition.positionTokenAddressFilled != loanOrder.loanTokenAddress) {
            (uint256 loanTokenAmount, uint256 positionTokenAmountUsed) = _tradePositionWithOracle(
                loanOrder,
                loanPosition,
                loanOrder.loanTokenAddress, // tradeTokenAddress
                MAX_UINT, // close the entire position
                false, // isLiquidation
                false // ensureHealthy
            );

            if (positionTokenAmountUsed < loanPosition.positionTokenAmountFilled) {
                // left over sourceToken needs to be dispursed
                if (! BZxVault(vaultContract).withdrawToken(
                    loanPosition.positionTokenAddressFilled,
                    loanTokenAmount >= loanPosition.loanTokenAmountFilled ? loanPosition.trader : orderLender[loanOrderHash],
                    loanPosition.positionTokenAmountFilled.sub(positionTokenAmountUsed)
                )) {
                    revert("BZxLoanHealth::liquidatePosition: BZxVault.withdrawToken excess failed");
                }
            }

            // the loan token becomes the new position token
            loanPosition.positionTokenAddressFilled = loanOrder.loanTokenAddress;
            loanPosition.positionTokenAmountFilled = loanTokenAmount;
        }

        return _finalizeLoan(
            loanOrder,
            loanPosition, // needs to be storage
            false, // isLiquidation
            gasUsed // initial used gas, collected in modifier
        );
    }

    function _finalizeLoan(
        LoanOrder memory loanOrder,
        LoanPosition storage loanPosition,
        bool isLiquidation,
        uint256 gasUsed)
        internal
        returns (bool)
    {
        require(loanPosition.positionTokenAddressFilled == loanOrder.loanTokenAddress, "BZxLoanHealth::_finalizeLoan: loanPosition.positionTokenAddressFilled != loanOrder.loanTokenAddress");

        if (loanOrder.interestAmount > 0) {
            LenderInterest storage oracleInterest = lenderOracleInterest[orderLender[loanOrder.loanOrderHash]][loanOrder.oracleAddress][loanOrder.interestTokenAddress];
            LenderInterest storage lenderInterest = lenderOrderInterest[loanOrder.loanOrderHash];
            TraderInterest storage traderInterest = traderLoanInterest[loanPosition.positionId];

            // update lender interest
            _payInterestForOrder(loanOrder, oracleInterest, lenderInterest, true);
            lenderInterest.interestOwedPerDay = lenderInterest.interestOwedPerDay.sub(traderInterest.interestOwedPerDay);
            oracleInterest.interestOwedPerDay = oracleInterest.interestOwedPerDay.sub(traderInterest.interestOwedPerDay);

            // update trader interest
            uint256 interestTime = block.timestamp;
            if (interestTime > loanPosition.loanEndUnixTimestampSec) {
                interestTime = loanPosition.loanEndUnixTimestampSec;
            }
            uint256 totalInterestToRefund = loanPosition.loanEndUnixTimestampSec.sub(interestTime).mul(traderInterest.interestOwedPerDay).div(86400);
            if (traderInterest.interestUpdatedDate > 0 && traderInterest.interestOwedPerDay > 0) {
                traderInterest.interestPaid = traderInterest.interestPaid.add(
                    interestTime.sub(traderInterest.interestUpdatedDate).mul(traderInterest.interestOwedPerDay).div(86400)
                );
            }
            traderInterest.interestUpdatedDate = interestTime;
            traderInterest.interestOwedPerDay = 0;
            traderInterest.interestDepositTotal = 0;

            if (totalInterestToRefund > 0) {
                if (! BZxVault(vaultContract).withdrawToken(
                    loanOrder.interestTokenAddress,
                    loanPosition.trader,
                    totalInterestToRefund
                )) {
                    revert("BZxLoanHealth::_finalizeLoan: BZxVault.withdrawToken interest failed");
                }

                tokenInterestOwed[orderLender[loanOrder.loanOrderHash]][loanOrder.interestTokenAddress] = totalInterestToRefund < tokenInterestOwed[orderLender[loanOrder.loanOrderHash]][loanOrder.interestTokenAddress] ?
                    tokenInterestOwed[orderLender[loanOrder.loanOrderHash]][loanOrder.interestTokenAddress].sub(totalInterestToRefund) :
                    0;
            }
        }

        if (isLiquidation || loanPosition.positionTokenAmountFilled < loanPosition.loanTokenAmountFilled) {
            // Send collateral to the oracle for processing. Unused collateral must be returned.
            if (! BZxVault(vaultContract).withdrawToken(
                loanPosition.collateralTokenAddressFilled,
                oracleAddresses[loanOrder.oracleAddress],
                loanPosition.collateralTokenAmountFilled
            )) {
                revert("BZxLoanHealth::_finalizeLoan: BZxVault.withdrawToken (collateral) failed");
            }

            (uint256 loanTokenAmountCovered, uint256 collateralTokenAmountUsed) = OracleInterface(oracleAddresses[loanOrder.oracleAddress]).processCollateral(
                loanOrder,
                loanPosition,
                loanPosition.positionTokenAmountFilled < loanPosition.loanTokenAmountFilled ? loanPosition.loanTokenAmountFilled - loanPosition.positionTokenAmountFilled : 0,
                isLiquidation);

            loanPosition.positionTokenAmountFilled = loanPosition.positionTokenAmountFilled.add(loanTokenAmountCovered);
            loanPosition.collateralTokenAmountFilled = loanPosition.collateralTokenAmountFilled.sub(collateralTokenAmountUsed);
        }

        if (loanPosition.collateralTokenAmountFilled > 0) {
            // send remaining collateral token back to the trader
            if (! BZxVault(vaultContract).withdrawToken(
                loanPosition.collateralTokenAddressFilled,
                loanPosition.trader,
                loanPosition.collateralTokenAmountFilled
            )) {
                revert("BZxLoanHealth::_finalizeLoan: BZxVault.withdrawToken collateral failed");
            }
        }

        if (loanPosition.positionTokenAmountFilled > 0) {
            if (loanPosition.positionTokenAmountFilled > loanPosition.loanTokenAmountFilled) {
                // send unpaid profit to the trader
                uint256 profit = loanPosition.positionTokenAmountFilled-loanPosition.loanTokenAmountFilled;
                if (! BZxVault(vaultContract).withdrawToken(
                    loanPosition.positionTokenAddressFilled, // same as loanTokenAddress
                    loanPosition.trader,
                    profit
                )) {
                    revert("BZxLoanHealth::_finalizeLoan: BZxVault.withdrawToken profit failed");
                }
                loanPosition.positionTokenAmountFilled = loanPosition.loanTokenAmountFilled;
            }

            // send remaining loan token back to the lender
            if (! BZxVault(vaultContract).withdrawToken(
                loanPosition.positionTokenAddressFilled, // same as loanTokenAddress
                orderLender[loanOrder.loanOrderHash],
                loanPosition.positionTokenAmountFilled
            )) {
                revert("BZxLoanHealth::_finalizeLoan: BZxVault.withdrawToken loan failed");
            }

            if (orderAux[loanOrder.loanOrderHash].expirationUnixTimestampSec == 0 || block.timestamp < orderAux[loanOrder.loanOrderHash].expirationUnixTimestampSec) {
                // since order is not expired, we make the positionTokenAmountFilled available for borrowing again
                orderFilledAmounts[loanOrder.loanOrderHash] = orderFilledAmounts[loanOrder.loanOrderHash].sub(loanPosition.positionTokenAmountFilled);

                if (!orderListIndex[loanOrder.loanOrderHash][address(0)].isSet && loanOrder.loanTokenAmount.sub(_getUnavailableLoanTokenAmount(loanOrder.loanOrderHash)) > 0) {
                    // record of fillable (non-expired/unfilled) orders
                    orderList[address(0)].push(loanOrder.loanOrderHash);
                    orderListIndex[loanOrder.loanOrderHash][address(0)] = ListIndex({
                        index: orderList[address(0)].length-1,
                        isSet: true
                    });
                }
            }
        }

        uint256 closeAmount = loanPosition.loanTokenAmountFilled;

        loanPosition.loanTokenAmountFilled = 0;
        //loanPosition.loanTokenAmountUsed = 0; <- not used yet
        loanPosition.active = false;
        _removePosition(
            loanOrder.loanOrderHash,
            loanPosition.trader);

        emit LogLoanClosed(
            orderLender[loanOrder.loanOrderHash],
            loanPosition.trader,
            msg.sender, // loanCloser
            isLiquidation,
            loanOrder.loanOrderHash,
            loanPosition.positionId
        );

        if (! OracleInterface(oracleAddresses[loanOrder.oracleAddress]).didCloseLoan(
            loanOrder,
            loanPosition,
            msg.sender, // loanCloser
            closeAmount,
            isLiquidation,
            gasUsed
        )) {
            revert("BZxLoanHealth::_finalizeLoan: OracleInterface.didCloseLoan failed");
        }

        return true;
    }

    function _removePosition(
        bytes32 loanOrderHash,
        address trader)
        internal
    {
        uint256 positionId = loanPositionsIds[loanOrderHash][trader];
        if (positionListIndex[positionId].isSet) {
            assert(positionList.length > 0);

            if (positionList.length > 1) {
                // get positionList index
                uint256 index = positionListIndex[positionId].index;
                
                // replace loan in list with last loan in array
                positionList[index] = positionList[positionList.length - 1];
                
                // update the position of this replacement
                positionListIndex[positionList[index].positionId].index = index;
            }

            // trim array
            positionList.length--;
        }
    }
}
