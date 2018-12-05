/**
 * Copyright 2017–2018, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */
 
/* solhint-disable func-order, separate-by-one-line-in-contract */

pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "./storage/BZxStorage.sol";
import "./ZeroEx/ExchangeV2Interface.sol";

// This interface is meant to used with the deployed BZxProxy contract (proxy/BZxProxy.sol) address.
// js example: var bZx = await BZx.at((await BZxProxy.deployed()).address);

contract BZx is BZxStorage {

    /*
    * BZxOrderTaking functions
    */

    /// @dev Takes the order as trader
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, maxDurationUnixTimestampSec, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param oracleData An arbitrary length bytes stream to pass to the oracle.
    /// @param collateralTokenFilled Desired address of the collateralTokenAddress the trader wants to use.
    /// @param loanTokenAmountFilled Desired amount of loanToken the trader wants to borrow.
    /// @param signature ECDSA signature in raw bytes (rsv).
    /// @return Total amount of loanToken borrowed (uint).
    /// @dev Traders can take a portion of the total coin being lended (loanTokenAmountFilled).
    /// @dev Traders also specify the token that will fill the margin requirement if they are taking the order.
    function takeLoanOrderAsTrader(
        address[6] orderAddresses,
        uint[10] orderValues,
        bytes oracleData,
        address collateralTokenFilled,
        uint loanTokenAmountFilled,
        bytes signature)
        external
        returns (uint);

    /// @dev Takes the order as trader, overcollateralizes the loan, and withdraws the loan token to the trader's wallet
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, maxDurationUnixTimestampSec, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param oracleData An arbitrary length bytes stream to pass to the oracle.
    /// @param collateralTokenFilled Desired address of the collateralTokenAddress the trader wants to use.
    /// @param loanTokenAmountFilled Desired amount of loanToken the trader wants to borrow.
    /// @param signature ECDSA signature in raw bytes (rsv).
    /// @return Total amount of loanToken borrowed (uint).
    /// @dev Traders can take a portion of the total coin being lended (loanTokenAmountFilled).
    /// @dev Traders also specify the token that will fill the margin requirement if they are taking the order.
    function takeLoanOrderAsTraderAndWithdraw(
        address[6] orderAddresses,
        uint[10] orderValues,
        bytes oracleData,
        address collateralTokenFilled,
        uint loanTokenAmountFilled,
        bytes signature)
        external
        returns (uint);

    /// @dev Takes the order as lender
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, maxDurationUnixTimestampSec, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param oracleData An arbitrary length bytes stream to pass to the oracle.
    /// @param signature ECDSA signature in raw bytes (rsv).
    /// @return Total amount of loanToken borrowed (uint).
    /// @dev Lenders have to fill the entire desired amount the trader wants to borrow.
    /// @dev This makes loanTokenAmountFilled = loanOrder.loanTokenAmount.
    function takeLoanOrderAsLender(
        address[6] orderAddresses,
        uint[10] orderValues,
        bytes oracleData,
        bytes signature)
        external
        returns (uint);

    /// @dev Pushes an order on chain
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, maxDurationUnixTimestampSec, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param oracleData An arbitrary length bytes stream to pass to the oracle.
    /// @param signature ECDSA signature in raw bytes (rsv).
    /// @return A unique hash representing the loan order.
    function pushLoanOrderOnChain(
        address[6] orderAddresses,
        uint[10] orderValues,
        bytes oracleData,
        bytes signature)
        external
        returns (bytes32);

    /// @dev Takes the order as trader that's already pushed on chain
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @return Total amount of loanToken borrowed (uint).
    /// @dev Traders can take a portion of the total coin being lended (loanTokenAmountFilled).
    /// @dev Traders also specify the token that will fill the margin requirement if they are taking the order.
    function takeLoanOrderOnChainAsTrader(
        bytes32 loanOrderHash,
        address collateralTokenFilled,
        uint loanTokenAmountFilled)
        external
        returns (uint);

    /// @dev Takes the order as trader that's already pushed on chain, overcollateralizes the loan, and withdraws the loan token to the trader's wallet
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @return Total amount of loanToken borrowed (uint).
    /// @dev Traders can take a portion of the total coin being lended (loanTokenAmountFilled).
    /// @dev Traders also specify the token that will fill the margin requirement if they are taking the order.
    function takeLoanOrderOnChainAsTraderAndWithdraw(
        bytes32 loanOrderHash,
        address collateralTokenFilled,
        uint loanTokenAmountFilled)
        external
        returns (uint);

    /// @dev Takes the order as lender that's already pushed on chain
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @return Total amount of loanToken borrowed (uint).
    /// @dev Lenders have to fill the entire desired amount the trader wants to borrow.
    /// @dev This makes loanTokenAmountFilled = loanOrder.loanTokenAmount.
    function takeLoanOrderOnChainAsLender(
        bytes32 loanOrderHash)
        external
        returns (uint);

    /// @dev Approves a hash on-chain using any valid signature type.
    ///      After presigning a hash, the preSign signature type will become valid for that hash and signer.
    /// @param signer Address that should have signed the hash generated by the loanOrder parameters given.
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, maxDurationUnixTimestampSec, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param oracleData An arbitrary length bytes stream to pass to the oracle.
    /// @param signature Proof that the hash has been signed by signer.
    function preSign(
        address signer,
        address[6] orderAddresses,
        uint[10] orderValues,
        bytes oracleData,
        bytes signature)
        external;

    /// @dev Approves a hash on-chain using any valid signature type.
    ///      After presigning a hash, the preSign signature type will become valid for that hash and signer.
    /// @param signer Address that should have signed the given hash.
    /// @param hash Signed Keccak-256 hash.
    /// @param signature Proof that the hash has been signed by signer.
    function preSignWithHash(
        address signer,
        bytes32 hash,
        bytes signature)
        external;

    /// @dev Cancels remaining (untaken) loan
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, maxDurationUnixTimestampSec, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param oracleData An arbitrary length bytes stream to pass to the oracle.
    /// @param cancelLoanTokenAmount The amount of remaining unloaned token to cancel.
    /// @return The amount of loan token canceled.
    function cancelLoanOrder(
        address[6] orderAddresses,
        uint[10] orderValues,
        bytes oracleData,
        uint cancelLoanTokenAmount)
        external
        returns (uint);

    /// @dev Cancels remaining (untaken) loan
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @param cancelLoanTokenAmount The amount of remaining unloaned token to cancel.
    /// @return The amount of loan token canceled.
    function cancelLoanOrderWithHash(
        bytes32 loanOrderHash,
        uint cancelLoanTokenAmount)
        external
        returns (uint);

    /// @dev Calculates Keccak-256 hash of order with specified parameters.
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, maxDurationUnixTimestampSec, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param oracleData An arbitrary length bytes stream to pass to the oracle.
    /// @return Keccak-256 hash of loanOrder.
    function getLoanOrderHash(
        address[6] orderAddresses,
        uint[10] orderValues,
        bytes oracleData)
        public
        view
        returns (bytes32);

    /// @dev Verifies that an order signature is valid.
    /// @param signer address of signer.
    /// @param hash Signed Keccak-256 hash.
    /// @param signature ECDSA signature in raw bytes (rsv) + signatureType.
    /// @return Validity of order signature.
    function isValidSignature(
        address signer,
        bytes32 hash,
        bytes signature)
        public
        pure
        returns (bool);

    /// @dev Calculates the initial collateral required to open the loan.
    /// @param collateralTokenAddress The collateral token used by the trader.
    /// @param oracleAddress The oracle address specified in the loan order.
    /// @param loanTokenAmountFilled The amount of loan token borrowed.
    /// @param initialMarginAmount The initial margin percentage amount (i.e. 50 == 50%)
    /// @return The minimum collateral requirement to open the loan.
    function getInitialCollateralRequired(
        address loanTokenAddress,
        address collateralTokenAddress,
        address oracleAddress,
        uint loanTokenAmountFilled,
        uint initialMarginAmount)
        public
        view
        returns (uint collateralTokenAmount);

    /// @dev Returns a bytestream of a single order.
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @return A concatenated stream of bytes.
    function getSingleOrder(
        bytes32 loanOrderHash)
        public
        view
        returns (bytes);

    /// @dev Returns a bytestream of data from orders that are available for taking.
    /// @param start The starting order in the order list to return.
    /// @param count The total amount of orders to return if they exist. Amount returned can be less.
    /// @return A concatenated stream of bytes.
    function getOrdersFillable(
        uint start,
        uint count)
        public
        view
        returns (bytes);

    /// @dev Returns a bytestream of order data for a user.
    /// @param loanParty The address of the maker or taker of the order.
    /// @param start The starting order in the order list to return.
    /// @param count The total amount of orders to return if they exist. Amount returned can be less.
    /// @return A concatenated stream of bytes.
    function getOrdersForUser(
        address loanParty,
        uint start,
        uint count)
        public
        view
        returns (bytes);

    /// @dev Returns a bytestream of loan data for a trader.
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @param trader The address of the trader/borrower of a loan.
    /// @return A concatenated stream of bytes.
    function getSingleLoan(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (bytes);

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
        returns (bytes);

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
        returns (bytes);

    /// @dev Returns a bytestream of active loans.
    /// @param start The starting loan in the loan list to return.
    /// @param count The total amount of loans to return if they exist. Amount returned can be less.
    /// @return A concatenated stream of PositionRef(loanOrderHash, trader) bytes.
    function getActiveLoans(
        uint start,
        uint count)
        public
        view
        returns (bytes);

    /// @dev Returns a LoanOrder object.
    /// @param loanOrderHash A unique hash representing the loan order.
    function getLoanOrder(
        bytes32 loanOrderHash)
        public
        view
        returns (LoanOrder);

    /// @dev Returns a LoanOrderAux object.
    /// @param loanOrderHash A unique hash representing the loan order.
    function getLoanOrderAux(
        bytes32 loanOrderHash)
        public
        view
        returns (LoanOrderAux);

    /// @dev Returns a LoanPosition object.
    /// @param positionId A unqiue id representing the loan position.
    function getLoanPosition(
        uint positionId)
        public
        view
        returns (LoanPosition);

    /*
    * BZxTradePlacing functions
    */

    /// @dev Executes a 0x trade using loaned funds.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param orderData0x 0x order arguments, converted to hex, padded to 32 bytes and concatenated (multi-order batching allowed)
    /// @param signature0x ECDSA of the 0x order (multi-order batching allowed)
    /// @return The amount of token received in the trade.
    function tradePositionWith0x(
        bytes32 loanOrderHash,
        bytes orderData0x,
        bytes signature0x)
        external
        returns (uint);

    /// @dev Executes a 0x trade using loaned funds.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param orders0x Array of 0x V2 order structs
    /// @param signatures0x Array of signatures for each of the V2 orders
    /// @return The amount of token received in the trade.
    function tradePositionWith0xV2(
        bytes32 loanOrderHash,
        ExchangeV2Interface.OrderV2[] memory orders0x,
        bytes[] memory signatures0x)
        public
        returns (uint);

    /// @dev Executes a market order trade using the oracle contract specified in the loan referenced by loanOrderHash
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param tradeTokenAddress The address of the token to buy in the trade
    /// @return The amount of token received in the trade.
    function tradePositionWithOracle(
        bytes32 loanOrderHash,
        address tradeTokenAddress)
        external
        returns (uint);

    /*
    * BZxLoanMaintenance functions
    */

    /// @dev Allows the trader to increase the collateral for a loan.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param collateralTokenFilled The address of the collateral token used
    /// @param depositAmount The amount of additional collateral token to deposit
    /// @return True on success
    function depositCollateral(
        bytes32 loanOrderHash,
        address collateralTokenFilled,
        uint depositAmount)
        external
        returns (bool);

    /// @dev Allows the trader to withdraw excess collateral for a loan.
    /// @dev Excess collateral is any amount above the initial margin.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param collateralTokenFilled The address of the collateral token used
    /// @return excessCollateral The amount of excess collateral token to withdraw. The actual amount withdrawn will be less if there's less excess.
    function withdrawExcessCollateral(
        bytes32 loanOrderHash,
        address collateralTokenFilled,
        uint withdrawAmount)
        external
        returns (uint excessCollateral);

    /// @dev Allows the trader to change the collateral token being used for a loan.
    /// @dev This function will transfer in the initial margin requirement of the new token and the old token will be refunded to the trader.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param collateralTokenFilled The address of the collateral token used.
    /// @return collateralTokenAmountFilled The amount of new collateral token filled
    function changeCollateral(
        bytes32 loanOrderHash,
        address collateralTokenFilled)
        external
        returns (uint collateralTokenAmountFilled);

    /// @dev Allows the trader to withdraw some or all of the position token for overcollateralized loans
    /// @dev The trader will only be able to withdraw an amount the keeps the loan at or above initial margin
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param withdrawAmount The amount of position token withdrawn
    /// @return True on success
    function withdrawPosition(
        bytes32 loanOrderHash,
        uint withdrawAmount)
        external
        returns (bool);

    /// @dev Allows the trader to return the position/loan token to increase their escrowed balance.
    /// @dev This should be used by the trader if they've withdraw an overcollateralized loan.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param depositTokenAddress The address of the position token being returned
    /// @param depositAmount The amount of position token to deposit
    /// @return True on success
    function depositPosition(
        bytes32 loanOrderHash,
        address depositTokenAddress,
        uint depositAmount)
        external
        returns (bool);

    /// @dev Allows the trader to withdraw their profits, if any.
    /// @dev Profits are paid out from the current positionToken.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @return profitAmount The amount of profit withdrawn denominated in positionToken
    function withdrawProfit(
        bytes32 loanOrderHash)
        external
        returns (uint profitAmount);

    /// @dev Allows the trader to transfer ownership of the underlying assets in a position to another user.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param newOwner The address receiving the transfer
    /// @return True on success
    function changeTraderOwnership(
        bytes32 loanOrderHash,
        address newOwner)
        external
        returns (bool);

    /// @dev Allows the lender to transfer ownership of the underlying assets in a position to another user.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param newOwner The address receiving the transfer
    /// @return True on success
    function changeLenderOwnership(
        bytes32 loanOrderHash,
        address newOwner)
        external
        returns (bool);

    /// @dev Allows a lender to increase the amount of token they will loan out for an order
    /// @dev The order must already be on chain and have been partially filled
    /// @dev Ensures the lender has enough balance and allowance
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param loanTokenAmountToAdd The amount to increase the loan token
    /// @return True on success
    function increaseLoanableAmount(
        bytes32 loanOrderHash,
        uint loanTokenAmountToAdd)      
        external
        returns (bool);

    /// @dev Allows the maker of an order to set a description
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param desc Descriptive text to attach to the loan order
    /// @return True on success
    function setLoanOrderDesc(
        bytes32 loanOrderHash,
        string desc)
        external
        returns (bool);

    /// @dev Get the current profit/loss data of a position
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The trader of the position
    /// @return isProfit False it there's a loss, True otherwise
    /// @return profitOrLoss The amount of profit or amount of loss (denominated in positionToken)
    /// @return positionTokenAddress The position token current filled, which could be the same as the loanToken
    function getProfitOrLoss(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (bool isProfit, uint profitOrLoss, address positionTokenAddress);

    /*
    * BZxLoanHealth functions
    */

    /// @dev Pays the lender of a loan the total amount of interest accrued for a loan.
    /// @dev Note that this function can be safely called by anyone.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The address of the trader/borrower of a loan.
    /// @return The amount of interest paid out.
    function payInterest(
        bytes32 loanOrderHash,
        address trader)
        external
        returns (uint);

    /// @dev Pays the lender the total amount of interest accrued from all loans for a given order.
    /// @dev This function can potentially run out of gas before finishing if there are two many loans assigned to
    /// @dev an order. If this occurs, interest owed can be paid out using the payInterest function. Payouts are
    /// @dev automatic as positions close, as well.
    /// @dev Note that this function can be safely called by anyone.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @return The amount of interest paid out.
    function payInterestForOrder(
        bytes32 loanOrderHash)
        external
        returns (uint);

    /// @dev Checks that a position meets the conditions for liquidation, then closes the position and loan.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The trader of the position
    /// @return True on success
    function liquidatePosition(
        bytes32 loanOrderHash,
        address trader)
        external
        returns (bool);

    /// @dev Called by the trader to close part of their loan early.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param closeAmount The amount of the loan token to return to the lender
    /// @return True on success
    function closeLoanPartially(
        bytes32 loanOrderHash,
        uint closeAmount)
        external
        returns (bool);

    /// @dev Called by the trader to close their loan early.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @return True on success
    function closeLoan(
        bytes32 loanOrderHash)
        external
        returns (bool);

    /// @dev Called by an admin to force close a loan early and return assets to the lender and trader as is.
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The trader of the position
    /// @return True on success
    function forceCloanLoan(
        bytes32 loanOrderHash,
        address trader)
        public
        returns (bool);

    /// @dev Checks the conditions for liquidation with the oracle
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The trader of the position
    /// @return True if liquidation should occur, false otherwise
    function shouldLiquidate(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (bool);

    /// @dev Gets current margin data for the loan
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The trader of the position
    /// @return initialMarginAmount The initial margin percentage set on the loan order
    /// @return maintenanceMarginAmount The maintenance margin percentage set on the loan order
    /// @return currentMarginAmount The current margin percentage, representing the health of the loan (i.e. 54350000000000000000 == 54.35%)
    function getMarginLevels(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (uint, uint, uint);

    /// @dev Gets current interest data for the loan
    /// @param loanOrderHash A unique hash representing the loan order
    /// @param trader The trader of the position
    /// @return lender The lender in this loan
    /// @return interestTokenAddress The interset token used in this loan
    /// @return interestTotalAccrued The total amount of interest that has been earned so far
    /// @return interestPaidSoFar The amount of earned interest that has been withdrawn
    /// @return interestLastPaidDate The date of the last interest pay out, or 0 if no interest has been withdrawn yet
    function getInterest(
        bytes32 loanOrderHash,
        address trader)
        public
        view
        returns (address lender, address interestTokenAddress, uint interestTotalAccrued, uint interestPaidSoFar, uint interestLastPaidDate);
}
