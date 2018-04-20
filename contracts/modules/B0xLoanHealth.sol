
pragma solidity ^0.4.23;

import 'zeppelin-solidity/contracts/math/Math.sol';

import './B0xStorage.sol';
import './B0xProxyContracts.sol';
import '../shared/InternalFunctions.sol';

import '../B0xVault.sol';
import '../interfaces/Oracle_Interface.sol';
import '../interfaces/B0xTo0x_Interface.sol';

contract B0xLoanHealth is B0xStorage, Proxiable, InternalFunctions {
    using SafeMath for uint256;

    constructor() public {}
    
    function initialize(
        address _target)
        public
        onlyOwner
    {
        targets[bytes4(keccak256("payInterest(bytes32,address)"))] = _target;
        targets[bytes4(keccak256("depositCollateral(bytes32,address,uint256)"))] = _target;
        targets[bytes4(keccak256("withdrawExcessCollateral(bytes32,address,uint256)"))] = _target;
        targets[bytes4(keccak256("changeCollateral(bytes32,address)"))] = _target;
        targets[bytes4(keccak256("withdrawProfit(bytes32)"))] = _target;
        targets[bytes4(keccak256("liquidatePosition(bytes32,address)"))] = _target;
        targets[bytes4(keccak256("closeLoan(bytes32)"))] = _target;
        targets[bytes4(keccak256("getProfitOrLoss(bytes32,address)"))] = _target;
        targets[bytes4(keccak256("shouldLiquidate(bytes32,address)"))] = _target;
        targets[bytes4(keccak256("getMarginLevels(bytes32,address)"))] = _target;
        targets[bytes4(keccak256("getInterest(bytes32,address)"))] = _target;
    }

    function payInterest(
        bytes32 loanOrderHash,
        address trader)
        external
        nonReentrant
        tracksGas
        returns (uint)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return intOrRevert(0,47);
        }

        // can still pay any unpaid accured interest after a loan has closed
        LoanPosition memory loanPosition = loanPositions[loanOrderHash][trader];
        if (loanPosition.loanTokenAmountFilled == 0) {
            return intOrRevert(0,53);
        }
        
        uint amountPaid = _payInterest(
            loanOrder,
            loanPosition
        );

        return amountPaid;
    }

    // Allows the trader to increase the collateral for an open loan
    function depositCollateral(
        bytes32 loanOrderHash,
        address collateralTokenFilled,
        uint depositAmount)
        external
        nonReentrant
        tracksGas
        returns (bool)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return boolOrRevert(false,76);
        }

        if (block.timestamp >= loanOrder.expirationUnixTimestampSec) {
            return boolOrRevert(false,80);
        }

        LoanPosition storage loanPosition = loanPositions[loanOrderHash][msg.sender];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return boolOrRevert(false,85);
        }

        if (collateralTokenFilled != loanPosition.collateralTokenAddressFilled) {
            return boolOrRevert(false,89);
        }

        if (! B0xVault(VAULT_CONTRACT).depositCollateral(
            collateralTokenFilled,
            msg.sender,
            depositAmount
        )) {
            return boolOrRevert(false,97);
        }

        loanPosition.collateralTokenAmountFilled = loanPosition.collateralTokenAmountFilled.add(depositAmount);

        if (! Oracle_Interface(loanOrder.oracleAddress).didDepositCollateral(
            loanOrder.loanOrderHash,
            msg.sender,
            gasUsed // initial used gas, collected in modifier
        )) {
            return boolOrRevert(false,107);
        }

        return true;
    }

    // Allows the trader to decrease excess collateral for an open loan
    // Excess collateral is any amount above the initial margin
    function withdrawExcessCollateral(
        bytes32 loanOrderHash,
        address collateralTokenFilled,
        uint withdrawAmount)
        external
        nonReentrant
        tracksGas
        returns (uint excessCollateral)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return intOrRevert(0,126);
        }

        LoanPosition storage loanPosition = loanPositions[loanOrderHash][msg.sender];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return intOrRevert(0,131);
        }

        if (collateralTokenFilled != loanPosition.collateralTokenAddressFilled) {
            return intOrRevert(0,135);
        }

        // the new collateral amount must be enough to satify the initial margin requirement of the loan
        uint initialCollateralTokenAmount = _getInitialCollateralRequired(
            loanOrder.loanTokenAddress,
            loanPosition.collateralTokenAddressFilled,
            loanOrder.oracleAddress,
            loanPosition.loanTokenAmountFilled,
            loanOrder.initialMarginAmount
        );
        if (initialCollateralTokenAmount == 0 || initialCollateralTokenAmount >= loanPosition.collateralTokenAmountFilled) {
            return intOrRevert(0,147);
        }

        excessCollateral = Math.min256(withdrawAmount, loanPosition.collateralTokenAmountFilled-initialCollateralTokenAmount);

        // transfer excess collateral to trader
        if (! B0xVault(VAULT_CONTRACT).withdrawCollateral(
            loanPosition.collateralTokenAddressFilled,
            msg.sender,
            excessCollateral
        )) {
            return intOrRevert(0,158);
        }

        // update stored collateral amount
        loanPosition.collateralTokenAmountFilled = loanPosition.collateralTokenAmountFilled.sub(excessCollateral);

        if (! Oracle_Interface(loanOrder.oracleAddress).didWithdrawCollateral(
            loanOrder.loanOrderHash,
            msg.sender,
            gasUsed // initial used gas, collected in modifier
        )) {
            return intOrRevert(0,169);
        }
    }

    // Allows the trader to change the collateral token being used for an open loan.
    // This function will transfer in the initial margin requirement of the new token.
    // The old token will be refunded to the trader.
    function changeCollateral(
        bytes32 loanOrderHash,
        address collateralTokenFilled)
        external
        nonReentrant
        tracksGas
        returns (bool)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return boolOrRevert(false,186);
        }

        LoanPosition storage loanPosition = loanPositions[loanOrderHash][msg.sender];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return boolOrRevert(false,191);
        }

        if (collateralTokenFilled == address(0) || collateralTokenFilled == loanPosition.collateralTokenAddressFilled) {
            return boolOrRevert(false,195);
        }

        if (block.timestamp >= loanOrder.expirationUnixTimestampSec) {
            return boolOrRevert(false,199);
        }

        // the new collateral amount must be enough to satify the initial margin requirement of the loan
        uint collateralTokenAmountFilled = _getInitialCollateralRequired(
            loanOrder.loanTokenAddress,
            collateralTokenFilled,
            loanOrder.oracleAddress,
            loanPosition.loanTokenAmountFilled,
            loanOrder.initialMarginAmount
        );
        if (collateralTokenAmountFilled == 0) {
            return boolOrRevert(false,211);
        }

        // transfer the new collateral token from the trader to the vault
        if (! B0xVault(VAULT_CONTRACT).depositCollateral(
            collateralTokenFilled,
            msg.sender,
            collateralTokenAmountFilled
        )) {
            return boolOrRevert(false,220);
        }

        // transfer the old collateral token from the vault to the trader
        if (! B0xVault(VAULT_CONTRACT).withdrawCollateral(
            loanPosition.collateralTokenAddressFilled,
            msg.sender,
            loanPosition.collateralTokenAmountFilled
        )) {
            return boolOrRevert(false,229);
        }

        loanPosition.collateralTokenAddressFilled = collateralTokenFilled;
        loanPosition.collateralTokenAmountFilled = collateralTokenAmountFilled;

        if (! Oracle_Interface(loanOrder.oracleAddress).didChangeCollateral(
            loanOrder.loanOrderHash,
            msg.sender,
            gasUsed // initial used gas, collected in modifier
        )) {
            return boolOrRevert(false,240);
        }

        return true;
    }

    // trader can withdraw their profits, if any
    // profits are paid out from the current positionToken
    function withdrawProfit(
        bytes32 loanOrderHash)
        external
        nonReentrant
        tracksGas
        returns (uint profitAmount)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        LoanPosition storage loanPosition = loanPositions[loanOrderHash][msg.sender];

        bool isProfit;
        (isProfit, profitAmount, ,) = _getProfitOrLoss(
            loanOrder,
            loanPosition);
        if (profitAmount == 0 || !isProfit) {
            return intOrRevert(0,263);
        }

        if (! B0xVault(VAULT_CONTRACT).transferToken(
            loanPosition.positionTokenAddressFilled,
            msg.sender,
            profitAmount
        )) {
            return intOrRevert(0,271);
        }

        // deduct profit from positionToken balance
        loanPosition.positionTokenAmountFilled = loanPosition.positionTokenAmountFilled.sub(profitAmount);

        if (! Oracle_Interface(loanOrder.oracleAddress).didWithdrawProfit(
            loanOrder.loanOrderHash,
            msg.sender,
            profitAmount,
            gasUsed // initial used gas, collected in modifier
        )) {
            return intOrRevert(0,283);
        }

        emit LogWithdrawProfit(
            loanOrder.loanOrderHash,
            msg.sender,
            profitAmount,
            loanPosition.positionTokenAmountFilled
        );

        return profitAmount;
    }

    function liquidatePosition(
        bytes32 loanOrderHash,
        address trader)
        external
        nonReentrant
        tracksGas
        returns (bool)
    {
        // traders should call closeLoan rather than this function
        if (trader == msg.sender) {
            return boolOrRevert(false,306);
        }

        LoanPosition storage loanPosition = loanPositions[loanOrderHash][trader];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return boolOrRevert(false,311);
        }

        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return boolOrRevert(false,316);
        }

        if (DEBUG_MODE) {
            _emitMarginLog(loanOrder, loanPosition);
        }

        // if the position token is not the loan token, then we need to buy back the loan token (if liquidation checks pass),
        // prior to closing the loan
        if (loanPosition.positionTokenAddressFilled != loanOrder.loanTokenAddress) {
            uint loanTokenAmount = _tradePositionWithOracle(
                loanOrder,
                loanPosition,
                loanOrder.loanTokenAddress, // tradeTokenAddress
                true // isLiquidation
            );

            if (loanTokenAmount == 0) {
                return boolOrRevert(false,334);
            }

            // the loan token becomes the new position token
            loanPosition.positionTokenAddressFilled = loanOrder.loanTokenAddress;
            loanPosition.positionTokenAmountFilled = loanTokenAmount;
        } else {
            // verify liquidation checks before proceeding to close the loan
            if (! Oracle_Interface(loanOrder.oracleAddress).shouldLiquidate(
                    loanOrderHash,
                    trader,
                    loanOrder.loanTokenAddress,
                    loanPosition.positionTokenAddressFilled,
                    loanPosition.collateralTokenAddressFilled,
                    loanPosition.loanTokenAmountFilled,
                    loanPosition.positionTokenAmountFilled,
                    loanPosition.collateralTokenAmountFilled,
                    loanOrder.maintenanceMarginAmount)) {
                return boolOrRevert(false,352);
            }
        }

        require(_closeLoan(
            loanOrder,
            loanPosition, // needs to be storage
            true, // isLiquidation
            gasUsed // initial used gas, collected in modifier
        ));

        return true;
    }

    // Called by the trader to close their loan early.
    // This function will fail if the position token is not currently the loan token.
    // tradePositionWith0x or tradePositionWithOracle should be called first to buy back the loan token if needed
    function closeLoan(
        bytes32 loanOrderHash)
        external
        nonReentrant
        tracksGas
        returns (bool)
    {
        LoanPosition storage loanPosition = loanPositions[loanOrderHash][msg.sender];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return boolOrRevert(false,378);
        }

        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return boolOrRevert(false,383);
        }

        if (loanPosition.positionTokenAddressFilled != loanOrder.loanTokenAddress) {
            return boolOrRevert(false,387);
        }

        return _closeLoan(
            loanOrder,
            loanPosition, // needs to be storage
            false, // isLiquidation
            gasUsed // initial used gas, collected in modifier
        );
    }

    /*
    * Constant public functions
    */

    // returns bool isProfit, uint profitOrLoss, uint positionToLoanAmount, uint positionToLoanRate
    // the position's profit/loss denominated in loanToken
    function getProfitOrLoss(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (bool isProfit, uint profitOrLoss, uint positionToLoanAmount, uint positionToLoanRate)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        LoanPosition memory loanPosition = loanPositions[loanOrderHash][trader];

        return _getProfitOrLoss(
            loanOrder,
            loanPosition);
    }

    function shouldLiquidate(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (bool)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return false;
        }

        LoanPosition memory loanPosition = loanPositions[loanOrderHash][trader];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return false;
        }

        if (block.timestamp >= loanOrder.expirationUnixTimestampSec) {
            return true; // expired loan
        }

        if (DEBUG_MODE) {
            _emitMarginLog(loanOrder, loanPosition);
        }

        return Oracle_Interface(loanOrder.oracleAddress).shouldLiquidate(
            loanOrderHash,
            trader,
            loanOrder.loanTokenAddress,
            loanPosition.positionTokenAddressFilled,
            loanPosition.collateralTokenAddressFilled,
            loanPosition.loanTokenAmountFilled,
            loanPosition.positionTokenAmountFilled,
            loanPosition.collateralTokenAmountFilled,
            loanOrder.maintenanceMarginAmount);
    }

    // returns initialMarginAmount, maintenanceMarginAmount, currentMarginAmount
    function getMarginLevels(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (uint, uint, uint)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return;
        }

        LoanPosition memory loanPosition = loanPositions[loanOrderHash][trader];
        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return;
        }

        return (_getMarginLevels(
            loanOrder,
            loanPosition));
    }

    function getInterest(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (address lender, address interestTokenAddress, uint totalAmountAccrued, uint interestPaidSoFar) {

        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            return;
        }

        // can still get interest for closed loans
        LoanPosition memory loanPosition = loanPositions[loanOrderHash][trader];
        if (loanPosition.loanTokenAmountFilled == 0) {
            return;
        }

        InterestData memory interestData = _getInterest(
            loanOrder,
            loanPosition
        );
        return (
            interestData.lender,
            interestData.interestTokenAddress,
            interestData.totalAmountAccrued,
            interestData.interestPaidSoFar
        );
    }


    /*
    * Constant Internal functions
    */

    function _getInterest(
        LoanOrder loanOrder,
        LoanPosition loanPosition)
        internal
        view
        returns (InterestData interestData)
    {
        uint interestTime = block.timestamp;
        if (interestTime > loanOrder.expirationUnixTimestampSec) {
            interestTime = loanOrder.expirationUnixTimestampSec;
        }

        uint totalAmountAccrued;
        if (loanPosition.active) {
            totalAmountAccrued = _getPartialAmountNoError(loanPosition.loanTokenAmountFilled, loanOrder.loanTokenAmount, interestTime.sub(loanPosition.loanStartUnixTimestampSec).mul(loanOrder.interestAmount).div(86400));
        } else {
            // this is so, because remaining interest is paid out when the loan is closed
            totalAmountAccrued = interestPaid[loanOrder.loanOrderHash][loanPosition.trader];
        }

        interestData = InterestData({
            lender: loanPosition.lender,
            interestTokenAddress: loanOrder.interestTokenAddress,
            totalAmountAccrued: totalAmountAccrued,
            interestPaidSoFar: interestPaid[loanOrder.loanOrderHash][loanPosition.trader]
        });
    }

    function _getProfitOrLoss(
        LoanOrder loanOrder,
        LoanPosition loanPosition)
        internal
        view
        returns (bool isProfit, uint profitOrLoss, uint positionToLoanAmount, uint positionToLoanRate)
    {
        if (loanOrder.maker == address(0)) {
            return;
        }

        if (loanPosition.loanTokenAmountFilled == 0 || !loanPosition.active) {
            return;
        }

        return Oracle_Interface(loanOrder.oracleAddress).getProfitOrLoss(
            loanPosition.positionTokenAddressFilled,
            loanOrder.loanTokenAddress,
            loanPosition.positionTokenAmountFilled,
            loanPosition.loanTokenAmountFilled);
    }

    /*
    * Internal functions
    */

    function _payInterest(
        LoanOrder loanOrder,
        LoanPosition loanPosition)
        internal
        returns (uint)
    {
        InterestData memory interestData = _getInterest(
            loanOrder,
            loanPosition);

        if (interestData.interestPaidSoFar >= interestData.totalAmountAccrued) {
            return 0;
        }

        uint amountPaid = interestData.totalAmountAccrued.sub(interestData.interestPaidSoFar);
        interestPaid[loanOrder.loanOrderHash][loanPosition.trader] = interestData.totalAmountAccrued; // since this function will pay all remaining accured interest
        
        // send the interest to the oracle for further processing
        if (! B0xVault(VAULT_CONTRACT).sendInterestToOracle(
            interestData.interestTokenAddress,
            loanPosition.trader,
            orders[loanOrder.loanOrderHash].oracleAddress,
            amountPaid
        )) {
            return intOrRevert(0,592);
        }

         // calls the oracle to signal processing of the interest (ie: paying the lender, retaining fees)
        if (! Oracle_Interface(loanOrder.oracleAddress).didPayInterest(
            loanOrder.loanOrderHash,
            loanPosition.trader,
            loanPosition.lender,
            interestData.interestTokenAddress,
            amountPaid,
            gasUsed // initial used gas, collected in modifier
        )) {
            return intOrRevert(0,604);
        }

        return amountPaid;
    }

    // NOTE: this function will only be called if loanPosition.positionTokenAddressFilled == loanOrder.loanTokenAddress
    function _closeLoan(
        LoanOrder loanOrder,
        LoanPosition storage loanPosition,
        bool isLiquidation,
        uint gasUsed)
        internal
        returns (bool)
    {
        // pay any remaining interest to the lender
        _payInterest(
            loanOrder,
            loanPosition
        );

        uint totalInterestToRefund = _getTotalInterestRequired(
            loanOrder.loanTokenAmount,
            loanPosition.loanTokenAmountFilled,
            loanOrder.interestAmount,
            loanOrder.expirationUnixTimestampSec,
            loanPosition.loanStartUnixTimestampSec)
            .sub(interestPaid[loanOrder.loanOrderHash][loanPosition.trader]);
        
        if (totalInterestToRefund > 0) {
            if (! B0xVault(VAULT_CONTRACT).withdrawInterest(
                loanOrder.interestTokenAddress,
                loanPosition.trader,
                totalInterestToRefund
            )) {
                return boolOrRevert(false,639);
            }
        }

        // check if lender is being made whole, and if not attempt to sell collateral token to cover losses
        if (loanPosition.positionTokenAmountFilled < loanPosition.loanTokenAmountFilled) {
            // Send all of the collateral token to the oracle to sell to cover loan token losses.
            // Unused collateral should be returned to the vault by the oracle.
            if (! B0xVault(VAULT_CONTRACT).transferToken(
                loanPosition.collateralTokenAddressFilled,
                loanOrder.oracleAddress,
                loanPosition.collateralTokenAmountFilled
            )) {
                return boolOrRevert(false,652);
            }

            uint loanTokenAmountCovered;
            uint collateralTokenAmountUsed;
            (loanTokenAmountCovered, collateralTokenAmountUsed) = Oracle_Interface(loanOrder.oracleAddress).doTradeofCollateral(
                loanPosition.collateralTokenAddressFilled,
                loanOrder.loanTokenAddress,
                loanPosition.collateralTokenAmountFilled,
                loanPosition.loanTokenAmountFilled.sub(loanPosition.positionTokenAmountFilled));
            
            loanPosition.positionTokenAmountFilled = loanPosition.positionTokenAmountFilled.add(loanTokenAmountCovered);
            loanPosition.collateralTokenAmountFilled = loanPosition.collateralTokenAmountFilled.sub(collateralTokenAmountUsed);
        }

        if (! B0xVault(VAULT_CONTRACT).withdrawCollateral(
            loanPosition.collateralTokenAddressFilled,
            loanPosition.trader,
            loanPosition.collateralTokenAmountFilled
        )) {
            return boolOrRevert(false,672);
        }

        if (! B0xVault(VAULT_CONTRACT).withdrawFunding(
            loanPosition.positionTokenAddressFilled, // same as loanTokenAddress
            loanPosition.lender,
            loanPosition.positionTokenAmountFilled
        )) {
            return boolOrRevert(false,680);
        }

        if (! Oracle_Interface(loanOrder.oracleAddress).didCloseLoan(
            loanOrder.loanOrderHash,
            msg.sender,
            isLiquidation,
            gasUsed
        )) {
            return boolOrRevert(false,689);
        }

        loanPosition.active = false;

        emit LogLoanClosed(
            loanPosition.lender,
            loanPosition.trader,
            isLiquidation,
            loanOrder.loanOrderHash
        );

        return true;
    }
}

