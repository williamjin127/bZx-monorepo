/**
 * Copyright 2017-2019, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.3;
pragma experimental ABIEncoderV2;

import "../openzeppelin-solidity/Math.sol";
import "../openzeppelin-solidity/SafeMath.sol";

import "../storage/BZxObjects.sol";
import "../modifiers/BZxOwnable.sol";
import "../modifiers/EMACollector.sol";
import "../modifiers/GasRefunder.sol";

import "../tokens/EIP20.sol";
import "../tokens/EIP20Wrapper.sol";
import "./OracleNotifier.sol";

import "../shared/WETHInterface.sol";


interface KyberNetworkInterface {
    function kyberNetworkContract()
        external
        view
        returns (address);

    function reservesPerTokenSrc(
        address addy)
        external
        view
        returns (address[] memory);

    function reservesPerTokenDest(
        address addy)
        external
        view
        returns (address[] memory);

    function reserveType(
        address addy)
        external
        view
        returns (ReserveType);

    enum ReserveType {NONE, PERMISSIONED, PERMISSIONLESS}
}

interface iMakerDAIPriceFeed {
    function read() external view returns (bytes32);
}

contract BZxOracle is EIP20Wrapper, EMACollector, GasRefunder, BZxOwnable {
    using SafeMath for uint256;

    uint256 internal constant MAX_UINT = 2**256 - 1;

    // this is the value the Kyber portal uses when setting a very high maximum number
    // uint256 internal constant MAX_FOR_KYBER = 10**28;

    // collateral collected to pay margin callers
    uint256 internal collateralReserve_;

    // supported tokens for rate lookups and swaps
    mapping (address => bool) public supportedTokens;

    // decimals of supported tokens
    mapping (address => uint256) public decimals;

    // maximum source amount a Kyber swap can accept
    mapping (address => uint256) public maxSourceAmountAllowed;

    // Margin callers are remembursed from collateral
    // The oracle requires a minimum amount
    uint256 public minCollateralInWethAmount = 0.5 ether;

    // If true, the collateral must not be below minCollateralInWethAmount for the loan to be opened
    // If false, the loan can be opened, but it won't be insured by the lender protection fund if collateral is below minCollateralInWethAmount
    bool public enforceMinimum = false;

    // Percentage of interest retained as fee
    // This will always be between 0 and 100%
    uint256 public interestFeePercent = 10 * 10**18;

    // Percentage of EMA-based gas refund paid to margin callers after successfully liquidating a position
    uint256 public marginCallerRewardPercent = 200 * 10**18;

    // An upper bound estimation on the liquidation gas cost
    uint256 public gasUpperBound = 4000000;

    // A threshold of minimum initial margin for loan to be insured by the guarantee fund
    // A value of 0 indicates that no threshold exists for this parameter.
    uint256 public minInitialMarginAmount = 0;

    // A threshold of minimum maintenance margin for loan to be insured by the guarantee fund
    // A value of 0 indicates that no threshold exists for this parameter.
    uint256 public minMaintenanceMarginAmount = 15 * 10**18;

    // If set, ensures that price queries only happen from Permissioned Kyber reserves
    bool public requirePermissionedReserveForQuery = true;

    // If set, ensures that token swaps only happen if priced from Permissioned Kyber reserves
    bool public requirePermissionedReserveForSwap = false;

    // Liquidation swaps must be priced from at least this amount of Permissioned Kyber reserves.
    uint256 public minPermissionedReserveCount = 0;

    // Percentage of maximum slippage allowed for Kyber swap when liquidating
    // This will always be between 0 and 100%
    uint256 public maxLiquidationSlippagePercent = 8 * 10**18;

    uint256 public maxSpreadPercentage = 3 * 10**18;

    // wallet address to send part of the fees to
    address public feeWallet = address(this);

    address public vaultContract;
    address public kyberContract;
    address public kyberNetworkContract;
    address public wethContract;
    address public bZRxTokenContract;
    address public oracleNotifier;

    mapping (uint256 => uint256) public collateralInWethAmounts; // mapping of position ids to initial collateralInWethAmounts

    constructor(
        address _vaultContract,
        address _kyberContract,
        address _wethContract,
        address _bZRxTokenContract,
        address _oracleNotifier,
        address _feeWallet)
        public
        payable
    {
        vaultContract = _vaultContract;
        kyberContract = _kyberContract;
        wethContract = _wethContract;
        bZRxTokenContract = _bZRxTokenContract;
        oracleNotifier = _oracleNotifier;

        setFeeWallet(_feeWallet);

        if (_kyberContract != address(0)) {
            kyberNetworkContract = KyberNetworkInterface(_kyberContract).kyberNetworkContract();
        }

        // settings for EMACollector
        emaValue = 20 * 10**9; // set an initial price average for gas
        emaPeriods = 30; // set periods to use for EMA calculation
    }

    // The contract needs to be able to receive Ether from Kyber trades
    // Fallback returns 1/True to allow a partial interface implementation
    function()
        external
        payable
    {
        if (msg.sender == bZxContractAddress) {
            updateEMA(tx.gasprice);
        }

        // always returns true
        assembly {
            mstore(0, 1)
            return(0, 32)
        }
    }


    function didAddOrder(
        BZxObjects.LoanOrder memory loanOrder,
        BZxObjects.LoanOrderAux memory /* loanOrderAux */,
        bytes memory oracleData,
        address /* takerAddress */,
        uint256 /* gasUsed */)
        public
        onlyBZx
        updatesEMA(tx.gasprice)
        returns (bool)
    {
        OracleNotifier(oracleNotifier).setNotifications(
            loanOrder.loanOrderHash,
            oracleData
        );

        return true;
    }

    // will not update the EMA
    function didPayInterest(
        BZxObjects.LoanOrder memory loanOrder,
        address lender,
        uint256 amountOwed,
        uint256 /* gasUsed */)
        public
        onlyBZx
        returns (bool)
    {
        // interestFeePercent is only editable by owner
        uint256 interestFee = amountOwed.mul(interestFeePercent).div(10**20);

        // Transfers the interest to the lender, less the interest fee.
        // The fee is retained by the oracle.
        uint256 amountPaid = amountOwed.sub(interestFee);
        if (!_transferToken(
            loanOrder.interestTokenAddress,
            lender,
            amountPaid)) {
            revert("BZxOracle::didPayInterest: _transferToken failed");
        }

        return true;
    }

    // will not update the EMA
    function didPayInterestByLender(
        address lender,
        address interestTokenAddress,
        uint256 amountOwed,
        uint256 /* gasUsed */)
        public
        onlyBZx
        returns (bool)
    {
        // interestFeePercent is only editable by owner
        uint256 interestFee = amountOwed.mul(interestFeePercent).div(10**20);

        // Transfers the interest to the lender, less the interest fee.
        // The fee is retained by the oracle.
        uint256 amountPaid = amountOwed.sub(interestFee);
        if (!_transferToken(
            interestTokenAddress,
            lender,
            amountPaid)) {
            revert("BZxOracle::didPayInterestByLender: _transferToken failed");
        }

        return true;
    }

    function didCloseLoan(
        BZxObjects.LoanOrder memory loanOrder,
        BZxObjects.LoanPosition memory loanPosition,
        address payable loanCloser,
        uint256 closeAmount,
        bool isLiquidation,
        uint256 gasUsed)
        public
        onlyBZx
        updatesEMA(tx.gasprice)
        returns (bool)
    {
        address notifier = OracleNotifier(oracleNotifier).closeLoanNotifier(loanOrder.loanOrderHash);
        if (notifier != address(0)) {
            // allow silent fail
            (bool result,) = notifier.call.gas(gasleft())(
                abi.encodeWithSignature(
                    "closeLoanNotifier((address,address,address,address,uint256,uint256,uint256,uint256,uint256,bytes32),(address,address,address,uint256,uint256,uint256,uint256,uint256,uint256,bool,uint256),address,uint256,bool)",
                    loanOrder,
                    loanPosition,
                    loanCloser,
                    closeAmount,
                    isLiquidation
                )
            );
            result;
        }

        // sends gas and reward to margin caller
        if (isLiquidation) {
            (uint256 refundAmount, uint256 finalGasUsed) = getGasRefund(
                gasUsed.add(20000), // excess to account for gas spent after this point
                emaValue,
                marginCallerRewardPercent
            );

            uint256 traderRefund;
            if (collateralReserve_ > refundAmount) {
                traderRefund = collateralReserve_-refundAmount;
            } else if (collateralReserve_ < refundAmount) {
                refundAmount = collateralReserve_;
            }

            if (refundAmount.add(traderRefund) != 0) {
                // refunds are paid in ETH
                uint256 wethBalance = EIP20(wethContract).balanceOf(address(this));

                if (wethBalance != 0) {
                    if (refundAmount >= wethBalance) {
                        refundAmount = wethBalance;
                        traderRefund = 0;
                    } else if (refundAmount.add(traderRefund) > wethBalance) {
                        traderRefund = wethBalance.sub(refundAmount);
                    }

                    WETHInterface(wethContract).withdraw(refundAmount.add(traderRefund));

                    if (refundAmount != 0) {
                        sendGasRefund(
                            loanCloser,
                            refundAmount,
                            finalGasUsed,
                            emaValue
                        );
                    }

                    if (traderRefund != 0 && traderRefund <= address(this).balance) {
                        // allow silent fail
                        bool result = address(uint256(loanPosition.trader)).send(traderRefund);
                        result;
                    }
                }
            }

            collateralReserve_ = 0;
        }

        return true;
    }

    function trade(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        uint256 maxDestTokenAmount)
        public
        onlyBZx
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        (destTokenAmountReceived, sourceTokenAmountUsed) = _trade(
            sourceTokenAddress,
            destTokenAddress,
            vaultContract,
            vaultContract,
            sourceTokenAmount,
            maxDestTokenAmount < 10**28 ? maxDestTokenAmount : 10**28,
            0 // minConversionRate
        );
    }

    function tradePosition(
        BZxObjects.LoanOrder memory loanOrder,
        BZxObjects.LoanPosition memory loanPosition,
        address destTokenAddress,
        uint256 maxDestTokenAmount,
        bool ensureHealthy)
        public
        onlyBZx
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        (destTokenAmountReceived, sourceTokenAmountUsed) = _trade(
            loanPosition.positionTokenAddressFilled,
            destTokenAddress,
            vaultContract,
            vaultContract,
            loanPosition.positionTokenAmountFilled,
            maxDestTokenAmount < 10**28 ? maxDestTokenAmount : 10**28,
            0 // minConversionRate
        );
        require(destTokenAmountReceived != 0 && destTokenAmountReceived != MAX_UINT, "destTokenAmountReceived == 0");

        if (ensureHealthy) {
            loanPosition.positionTokenAddressFilled = destTokenAddress;
            loanPosition.positionTokenAmountFilled = destTokenAmountReceived;

            // trade can't trigger liquidation
            if (shouldLiquidate(
                loanOrder,
                loanPosition)) {
                revert("BZxOracle::tradePosition: trade triggers liquidation");
            }
        }
    }

    function liquidatePosition(
        BZxObjects.LoanOrder memory loanOrder,
        BZxObjects.LoanPosition memory loanPosition,
        uint256 maxDestTokenAmount)
        public
        onlyBZx
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        if (minPermissionedReserveCount != 0) {
            _checkReserveCount(
                loanOrder,
                loanPosition
            );
        }

        uint256 minConversionRate;
        if (maxLiquidationSlippagePercent != 100 ether) {
            minConversionRate = _getMinConversionRate(
                loanOrder,
                loanPosition
            );
        }

        (destTokenAmountReceived, sourceTokenAmountUsed) = _trade(
            loanPosition.positionTokenAddressFilled,
            loanOrder.loanTokenAddress,
            vaultContract,
            vaultContract,
            loanPosition.positionTokenAmountFilled,
            maxDestTokenAmount < 10**28 ? maxDestTokenAmount : 10**28,
            minConversionRate
        );
        require(destTokenAmountReceived != 0 && destTokenAmountReceived != MAX_UINT, "destTokenAmountReceived == 0");
    }

    // note: bZx will only call this function if isLiquidation=true or loanTokenAmountNeeded != 0
    function processCollateral(
        BZxObjects.LoanOrder memory loanOrder,
        BZxObjects.LoanPosition memory loanPosition,
        uint256 loanTokenAmountNeeded,
        bool isLiquidation)
        public
        onlyBZx
        returns (uint256 loanTokenAmountCovered, uint256 collateralTokenAmountUsed)
    {
        require(isLiquidation || loanTokenAmountNeeded != 0, "!isLiquidation && loanTokenAmountNeeded == 0");

        uint256 collateralTokenBalance = EIP20(loanPosition.collateralTokenAddressFilled).balanceOf(address(this));
        if (collateralTokenBalance < loanPosition.collateralTokenAmountFilled) { // sanity check
            revert("BZxOracle::processCollateral: collateralTokenBalance < loanPosition.collateralTokenAmountFilled");
        }

        uint256 wethAmountReceived;
        (wethAmountReceived, collateralTokenAmountUsed) = _getWethFromCollateral(
            loanPosition.collateralTokenAddressFilled,
            loanOrder.loanTokenAddress,
            loanPosition.collateralTokenAmountFilled,
            loanTokenAmountNeeded,
            isLiquidation
        );

        if (loanTokenAmountNeeded != 0) {
            uint256 wethBalance = EIP20(wethContract).balanceOf(address(this));
            if (//(!enforceMinimum || collateralInWethAmounts[loanPosition.positionId] == 0 || collateralInWethAmounts[loanPosition.positionId] >= minCollateralInWethAmount) &&
                (minInitialMarginAmount == 0 || loanOrder.initialMarginAmount >= minInitialMarginAmount) &&
                (minMaintenanceMarginAmount == 0 || loanOrder.maintenanceMarginAmount >= minMaintenanceMarginAmount)) {
                // cover losses with collateral proceeds + lender protection fund
                (loanTokenAmountCovered,) = _trade(
                    wethContract,
                    loanOrder.loanTokenAddress,
                    vaultContract,
                    address(this),
                    wethBalance, // maximum usable amount
                    loanTokenAmountNeeded,
                    0 // minConversionRate
                );
            } else {
                // cover losses with just collateral proceeds
                (loanTokenAmountCovered,) = _trade(
                    wethContract,
                    loanOrder.loanTokenAddress,
                    vaultContract,
                    address(this),
                    wethAmountReceived > wethBalance ? wethBalance : wethAmountReceived, // maximum usable amount
                    loanTokenAmountNeeded,
                    0 // minConversionRate
                );
            }
            if (loanTokenAmountCovered == MAX_UINT) {
                loanTokenAmountCovered = 0;
            }
        }

        if (collateralTokenAmountUsed < loanPosition.collateralTokenAmountFilled) {
            uint256 refundAmount = loanPosition.collateralTokenAmountFilled-collateralTokenAmountUsed;
            collateralTokenBalance = EIP20(loanPosition.collateralTokenAddressFilled).balanceOf(address(this));

            // send unused collateral token back to the vault
            if (!_transferToken(
                loanPosition.collateralTokenAddressFilled,
                vaultContract,
                refundAmount > collateralTokenBalance ? collateralTokenBalance : refundAmount)) {
                revert("BZxOracle::processCollateral: _transferToken failed");
            }
        }
    }

    /*
    * Public View functions
    */

    function shouldLiquidate(
        BZxObjects.LoanOrder memory loanOrder,
        BZxObjects.LoanPosition memory loanPosition)
        public
        view
        returns (bool)
    {
        return (
            getCurrentMarginAmount(
                loanOrder.loanTokenAddress,
                loanPosition.positionTokenAddressFilled,
                loanPosition.collateralTokenAddressFilled,
                loanPosition.loanTokenAmountFilled,
                loanPosition.positionTokenAmountFilled,
                loanPosition.collateralTokenAmountFilled) <= loanOrder.maintenanceMarginAmount
            );
    }

    function isTradeSupported(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount)
        public
        view
        returns (bool)
    {
        (uint256 rate, uint256 slippage) = _getExpectedRate(
            sourceTokenAddress,
            destTokenAddress,
            sourceTokenAmount,
            false // saneRate
        );

        if (rate != 0 && slippage != 0)
            return true;
        else
            return false;
    }

    function getTradeData(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount)
        public
        view
        returns (uint256 sourceToDestRate, uint256 sourceToDestPrecision, uint256 destTokenAmount)
    {
        if (sourceTokenAmount < 10**28) {
            (sourceToDestRate,) = _getExpectedRate(
                sourceTokenAddress,
                destTokenAddress,
                sourceTokenAmount,
                false // saneRate
            );

            sourceToDestPrecision = _getDecimalPrecision(sourceTokenAddress, destTokenAddress);

            destTokenAmount = sourceTokenAmount
                                .mul(sourceToDestRate)
                                .div(sourceToDestPrecision);
        } else {
            (sourceToDestRate,) = _getExpectedRate(
                sourceTokenAddress,
                destTokenAddress,
                uint256(-1),
                true // saneRate
            );

            sourceToDestPrecision = _getDecimalPrecision(sourceTokenAddress, destTokenAddress);
        }
    }

    function getPositionOffset(
        BZxObjects.LoanOrder memory loanOrder,
        BZxObjects.LoanPosition memory loanPosition)
        public
        view
        returns (bool isPositive, uint256 positionOffsetAmount, uint256 loanOffsetAmount, uint256 collateralOffsetAmount)
    {
        uint256 collateralToLoanAmount;
        uint256 collateralToLoanRatePrecise;
        if (loanPosition.collateralTokenAddressFilled == loanOrder.loanTokenAddress) {
            collateralToLoanAmount = loanPosition.collateralTokenAmountFilled;
            collateralToLoanRatePrecise = 10**18;
        } else {
            (collateralToLoanRatePrecise,) = _getExpectedRate(
                loanPosition.collateralTokenAddressFilled,
                loanOrder.loanTokenAddress,
                loanPosition.collateralTokenAmountFilled,
                false // saneRate
            );

            if (collateralToLoanRatePrecise != 0) {
                collateralToLoanRatePrecise = collateralToLoanRatePrecise.mul(10**18).div(_getDecimalPrecision(loanPosition.collateralTokenAddressFilled, loanOrder.loanTokenAddress));
                collateralToLoanAmount = loanPosition.collateralTokenAmountFilled.mul(collateralToLoanRatePrecise).div(10**18);
            }
        }

        uint256 positionToLoanAmount;
        uint256 positionToLoanRatePrecise;
        if (loanPosition.positionTokenAddressFilled == loanOrder.loanTokenAddress) {
            positionToLoanAmount = loanPosition.positionTokenAmountFilled;
            positionToLoanRatePrecise = 10**18;
        } else {
            (positionToLoanRatePrecise,) = _getExpectedRate(
                loanPosition.positionTokenAddressFilled,
                loanOrder.loanTokenAddress,
                loanPosition.positionTokenAmountFilled,
                false // saneRate
            );

            if (positionToLoanRatePrecise != 0) {
                positionToLoanRatePrecise = positionToLoanRatePrecise.mul(10**18).div(_getDecimalPrecision(loanPosition.positionTokenAddressFilled, loanOrder.loanTokenAddress));
                positionToLoanAmount = loanPosition.positionTokenAmountFilled.mul(positionToLoanRatePrecise).div(10**18);
            }
        }

        positionToLoanAmount = positionToLoanAmount.add(collateralToLoanAmount);
        uint256 initialCombinedCollateral = loanPosition.loanTokenAmountFilled.add(loanPosition.loanTokenAmountFilled.mul(loanOrder.initialMarginAmount).div(10**20));

        isPositive = false;
        if (positionToLoanAmount > initialCombinedCollateral) {
            loanOffsetAmount = positionToLoanAmount.sub(initialCombinedCollateral);
            isPositive = true;
        } else if (positionToLoanAmount < initialCombinedCollateral) {
            loanOffsetAmount = initialCombinedCollateral.sub(positionToLoanAmount);
        }

        if (positionToLoanRatePrecise != 0) {
            positionOffsetAmount = loanOffsetAmount.mul(10**18).div(positionToLoanRatePrecise);
        }
        if (collateralToLoanRatePrecise != 0) {
            collateralOffsetAmount = loanOffsetAmount.mul(10**18).div(collateralToLoanRatePrecise);
        }
    }

    /// @return The current margin amount (a percentage -> i.e. 54350000000000000000 == 54.35%)
    function getCurrentMarginAmount(
        address loanTokenAddress,
        address positionTokenAddress,
        address collateralTokenAddress,
        uint256 loanTokenAmount,
        uint256 positionTokenAmount,
        uint256 collateralTokenAmount)
        public
        view
        returns (uint256)
    {
        uint256 sourceToDestRate;
        uint256 sourceToDestPrecision;

        uint256 collateralToLoanAmount;
        if (collateralTokenAddress == loanTokenAddress) {
            collateralToLoanAmount = collateralTokenAmount;
        } else {
            (sourceToDestRate,sourceToDestPrecision,) = getTradeData(
                collateralTokenAddress,
                loanTokenAddress,
                10**28 // collateralTokenAmount
            );
            collateralToLoanAmount = collateralTokenAmount
                .mul(sourceToDestRate)
                .div(sourceToDestPrecision);
        }

        uint256 positionToLoanAmount;
        if (positionTokenAddress == loanTokenAddress) {
            positionToLoanAmount = positionTokenAmount;
        } else {
            (sourceToDestRate,sourceToDestPrecision,) = getTradeData(
                positionTokenAddress,
                loanTokenAddress,
                10**28 // positionTokenAmount
            );
            positionToLoanAmount = positionTokenAmount
                .mul(sourceToDestRate)
                .div(sourceToDestPrecision);
        }

        if (positionToLoanAmount >= loanTokenAmount) {
            return collateralToLoanAmount.add(positionToLoanAmount).sub(loanTokenAmount).mul(10**20).div(loanTokenAmount);
        } else {
            uint256 offset = loanTokenAmount.sub(positionToLoanAmount);
            if (collateralToLoanAmount > offset) {
                return collateralToLoanAmount.sub(offset).mul(10**20).div(loanTokenAmount);
            } else {
                return 0;
            }
        }
    }

    function setDecimalsBatch(
        EIP20[] memory tokens)
        public
    {
        for (uint256 i=0; i < tokens.length; i++) {
            decimals[address(tokens[i])] = tokens[i].decimals();
        }
    }

    function tradeUserAsset(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        address returnToSenderAddress,
        uint256 sourceTokenAmount,
        uint256 maxDestTokenAmount,
        uint256 minConversionRate)
        public
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        require(EIP20(sourceTokenAddress).transferFrom(
            msg.sender,
            address(this),
            sourceTokenAmount
        ), "transfer of source token failed");

        if (destTokenAddress == address(0)) {
            destTokenAddress = address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee); // Kyber ETH designation
        }

        (destTokenAmountReceived, sourceTokenAmountUsed) = _trade(
            sourceTokenAddress,
            destTokenAddress,
            receiverAddress,
            returnToSenderAddress,
            sourceTokenAmount,
            maxDestTokenAmount,
            minConversionRate
        );
        require(destTokenAmountReceived != 0 && destTokenAmountReceived != MAX_UINT, "destTokenAmountReceived == 0");
    }

    /*
    * Owner functions
    */

    function setSupportedTokensBatch(
        address[] memory tokens,
        bool[] memory toggles)
        public
        onlyOwner
    {
        require(tokens.length == toggles.length, "count mismatch");

        for (uint256 i=0; i < tokens.length; i++) {
            supportedTokens[tokens[i]] = toggles[i];
        }
    }

    function setMaxSourceAmountAllowedBatch(
        address[] memory tokens,
        uint256[] memory amounts)
        public
        onlyOwner
    {
        require(tokens.length == amounts.length, "mismatch");
        for (uint256 i=0; i < tokens.length; i++) {
            maxSourceAmountAllowed[tokens[i]] = amounts[i];
        }
    }

    function setMinCollateralInWethAmount(
        uint256 newValue,
        bool enforce)
        public
        onlyOwner
    {
        if (newValue != minCollateralInWethAmount)
            minCollateralInWethAmount = newValue;

        if (enforce != enforceMinimum)
            enforceMinimum = enforce;
    }

    function setInterestFeePercent(
        uint256 newRate)
        public
        onlyOwner
    {
        require(newRate != interestFeePercent && newRate <= 10**20);
        interestFeePercent = newRate;
    }

    function setMarginCallerPercent(
        uint256 newValue)
        public
        onlyOwner
    {
        require(newValue != marginCallerRewardPercent);
        marginCallerRewardPercent = newValue;
    }

    function setGasUpperBound(
        uint256 newValue)
        public
        onlyOwner
    {
        require(newValue != gasUpperBound);
        gasUpperBound = newValue;
    }

    function setMarginThresholds(
        uint256 newInitialMargin,
        uint256 newMaintenanceMargin)
        public
        onlyOwner
    {
        require(newInitialMargin >= newMaintenanceMargin);
        minInitialMarginAmount = newInitialMargin;
        minMaintenanceMarginAmount = newMaintenanceMargin;
    }

    function setRequirePermissionedReserve(
        bool queryValue,
        bool swapValue)
        public
        onlyOwner
    {
        requirePermissionedReserveForQuery = queryValue;
        requirePermissionedReserveForSwap = swapValue;
    }

    function setMinPermissionedReserveCount(
        uint256 newValue)
        public
        onlyOwner
    {
        require(newValue != minPermissionedReserveCount);
        minPermissionedReserveCount = newValue;
    }

    function setMaxLiquidationSlippagePercent(
        uint256 newAmount)
        public
        onlyOwner
    {
        require(newAmount != maxLiquidationSlippagePercent && newAmount <= 10**20);
        maxLiquidationSlippagePercent = newAmount;
    }

    function setMaxSpreadPercentage(
        uint256 newAmount)
        public
        onlyOwner
    {
        require(newAmount != maxSpreadPercentage);
        maxSpreadPercentage = newAmount;
    }

    function setVaultContractAddress(
        address newAddress)
        public
        onlyOwner
    {
        require(newAddress != vaultContract && newAddress != address(0));
        vaultContract = newAddress;
    }

    function setKyberContractAddress(
        address newAddress)
        public
        onlyOwner
    {
        require(newAddress != kyberContract && newAddress != address(0));
        kyberContract = newAddress;
    }

    function setKyberNetworkContractAddress()
        public
        onlyOwner
    {
        kyberNetworkContract = KyberNetworkInterface(kyberContract).kyberNetworkContract();
    }

    function setWethContractAddress(
        address newAddress)
        public
        onlyOwner
    {
        require(newAddress != wethContract && newAddress != address(0));
        wethContract = newAddress;
    }

    function setBZRxTokenContractAddress(
        address newAddress)
        public
        onlyOwner
    {
        require(newAddress != bZRxTokenContract && newAddress != address(0));
        bZRxTokenContract = newAddress;
    }

    function setOracleNotifierAddress(
        address newAddress)
        public
        onlyOwner
    {
        require(newAddress != oracleNotifier && newAddress != address(0));
        oracleNotifier = newAddress;
    }

    function setEMAValue(
        uint256 _newEMAValue)
        public
        onlyOwner
    {
        require(_newEMAValue != emaValue);
        emaValue = _newEMAValue;
    }

    function setEMAPeriods(
        uint256 _newEMAPeriods)
        public
        onlyOwner
    {
        require(_newEMAPeriods > 1 && _newEMAPeriods != emaPeriods);
        emaPeriods = _newEMAPeriods;
    }

    function setFeeWallet(
        address _wallet)
        public
        onlyOwner
    {
        if (_wallet == address(0)) {
            feeWallet = address(this);
        } else {
            feeWallet = _wallet;
        }
    }

    function wrapEther()
        public
        onlyOwner
    {
        if (address(this).balance != 0) {
            WETHInterface(wethContract).deposit.value(address(this).balance)();
        }
    }

    function transferEther(
        address payable to,
        uint256 value)
        public
        onlyOwner
        returns (bool)
    {
        return (_transferEther(
            to,
            value
        ));
    }

    function transferToken(
        address tokenAddress,
        address to,
        uint256 value)
        public
        onlyOwner
        returns (bool)
    {
        uint256 balance = EIP20(tokenAddress).balanceOf(address(this));
        if (value > balance) {
            return EIP20(tokenAddress).transfer(
                to,
                balance
            );
        } else {
            return EIP20(tokenAddress).transfer(
                to,
                value
            );
        }
    }

    function tradeOwnedAsset(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        uint256 minConversionRate)
        public
        onlyOwner
        returns (uint256 destTokenAmountReceived)
    {
        (destTokenAmountReceived,) = _trade(
            sourceTokenAddress,
            destTokenAddress,
            address(this),
            address(this),
            sourceTokenAmount,
            10**28,
            minConversionRate
        );
        require(destTokenAmountReceived != 0 && destTokenAmountReceived != MAX_UINT, "destTokenAmountReceived == 0");
    }

    /*
    * Internal functions
    */

    function _getWethFromCollateral(
        address collateralTokenAddress,
        address loanTokenAddress,
        uint256 collateralTokenAmountUsable,
        uint256 loanTokenAmountNeeded,
        bool isLiquidation)
        internal
        returns (uint256 wethAmountReceived, uint256 collateralTokenAmountUsed)
    {
        uint256 wethAmountNeeded;

        if (loanTokenAmountNeeded != 0) {
            if (loanTokenAddress == wethContract) {
                wethAmountNeeded = loanTokenAmountNeeded;
            } else {
                (,,wethAmountNeeded) = getTradeData(
                    loanTokenAddress,
                    wethContract,
                    loanTokenAmountNeeded
                );
            }
        }

        if (isLiquidation) {
            collateralReserve_ = gasUpperBound.mul(emaValue).mul(marginCallerRewardPercent).div(10**20);
            wethAmountNeeded = wethAmountNeeded.add(collateralReserve_);
        }

        if (wethAmountNeeded != 0) {
            // trade collateral token for WETH
            (wethAmountReceived, collateralTokenAmountUsed) = _trade(
                collateralTokenAddress,
                wethContract,
                address(this), // BZxOracle receives the WETH proceeds
                address(this),
                collateralTokenAmountUsable,
                wethAmountNeeded,
                0 // minConversionRate
            );
            if (wethAmountReceived == MAX_UINT) {
                wethAmountReceived = 0;
            }
            if (isLiquidation && wethAmountReceived < collateralReserve_) {
                // we can't refund more than we receive
                collateralReserve_ = wethAmountReceived;
            }
        }
    }

    function _checkReserveCount(
        BZxObjects.LoanOrder memory loanOrder,
        BZxObjects.LoanPosition memory loanPosition)
        internal
        view
    {
        if (minPermissionedReserveCount == 0)
            return;

        KyberNetworkInterface kyber = KyberNetworkInterface(kyberNetworkContract);

        address[] memory reserveArrSrc = kyber.reservesPerTokenSrc(loanPosition.positionTokenAddressFilled);
        require(reserveArrSrc.length != 0, "BZxOracle::_checkReserveCount: no reserves for this trade");

        address[] memory reserveArrDest = kyber.reservesPerTokenDest(loanOrder.loanTokenAddress);
        require(reserveArrDest.length != 0, "BZxOracle::_checkReserveCount: no reserves for this trade");

        uint256 reserveCount;
        for (uint256 i; i < reserveArrSrc.length; i++) {
            if (kyber.reserveType(reserveArrSrc[i]) == KyberNetworkInterface.ReserveType.PERMISSIONED) {
                reserveCount++;
                if (reserveCount == minPermissionedReserveCount)
                    break;
            }
        }
        require (reserveCount == minPermissionedReserveCount, "BZxOracle::_checkReserveCount: too few reserves for this trade");

        reserveCount = 0;
        for (uint256 i; i < reserveArrDest.length; i++) {
            if (kyber.reserveType(reserveArrDest[i]) == KyberNetworkInterface.ReserveType.PERMISSIONED) {
                reserveCount++;
                if (reserveCount == minPermissionedReserveCount)
                    break;
            }
        }
        require (reserveCount == minPermissionedReserveCount, "BZxOracle::_checkReserveCount: too few reserves for this trade");
    }

    function _getMinConversionRate(
        BZxObjects.LoanOrder memory loanOrder,
        BZxObjects.LoanPosition memory loanPosition)
        internal
        view
        returns (uint256)
    {
        uint256 sourceTokenDecimals = decimals[loanPosition.positionTokenAddressFilled];
        if (sourceTokenDecimals == 0)
            sourceTokenDecimals = EIP20(loanPosition.positionTokenAddressFilled).decimals();

        uint256 sourceTokenAmount = 10**(sourceTokenDecimals >= 2 ?
            sourceTokenDecimals-2 :
            sourceTokenDecimals
        );

        if (loanPosition.positionTokenAmountFilled <= sourceTokenAmount) {
            // rate will be better than or equal to sane rate, so include no minimum restriction
            return 0;
        }

        (uint256 goodRate,) = _getExpectedRateCall(
            loanPosition.positionTokenAddressFilled,
            loanOrder.loanTokenAddress,
            sourceTokenAmount,
            true // saneRate
        );

        require(goodRate != 0, "can't find good rate");

        return goodRate
            .sub(goodRate
                .mul(maxLiquidationSlippagePercent)
                .div(10**20));
    }

    function _getDecimalPrecision(
        address sourceTokenAddress,
        address destTokenAddress)
        internal
        view
        returns(uint256)
    {
        if (sourceTokenAddress == destTokenAddress) {
            return 10**18;
        } else {
            uint256 sourceTokenDecimals = decimals[sourceTokenAddress];
            if (sourceTokenDecimals == 0)
                sourceTokenDecimals = EIP20(sourceTokenAddress).decimals();

            uint256 destTokenDecimals = decimals[destTokenAddress];
            if (destTokenDecimals == 0)
                destTokenDecimals = EIP20(destTokenAddress).decimals();

            if (destTokenDecimals >= sourceTokenDecimals)
                return 10**(SafeMath.sub(18, destTokenDecimals-sourceTokenDecimals));
            else
                return 10**(SafeMath.add(18, sourceTokenDecimals-destTokenDecimals));
        }
    }

    function _getExpectedRate(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        bool saneRate)
        internal
        view
        returns (uint256 expectedRate, uint256 slippageRate)
    {
        if (sourceTokenAddress == address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee)) {
            sourceTokenAddress = wethContract;
        }
        if (destTokenAddress == address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee)) {
            destTokenAddress = wethContract;
        }

        if (sourceTokenAddress == destTokenAddress) {
            expectedRate = 10**18;
            slippageRate = 10**18;
        } else {
            if (sourceTokenAmount != 0) {
                require(supportedTokens[sourceTokenAddress] && supportedTokens[destTokenAddress], "invalid tokens");

                if (saneRate) {
                    (expectedRate, slippageRate) = _getExpectedRateCall(
                        sourceTokenAddress,
                        destTokenAddress,
                        0,   // sourceTokenAmount
                        true // saneRate
                    );

                    (uint256 reversedRate, uint256 reversedSlippageRate) = _getExpectedRateCall(
                        destTokenAddress,
                        sourceTokenAddress,
                        0,   // sourceTokenAmount
                        true // saneRate
                    );

                    if (expectedRate != 0 && reversedRate != 0) {
                        reversedRate = SafeMath.div(10**36, reversedRate);

                        uint256 maxSpread = maxSpreadPercentage;
                        if (maxSpread != 0 && reversedRate < expectedRate) {
                            uint256 spreadPercentage = expectedRate
                                .sub(reversedRate);
                            spreadPercentage = spreadPercentage
                                .mul(10**20);
                            spreadPercentage = spreadPercentage
                                .div(expectedRate);

                            require(
                                spreadPercentage <= maxSpread,
                                "bad price"
                            );
                        }

                        reversedSlippageRate = SafeMath.div(10**36, reversedSlippageRate);

                        expectedRate = expectedRate.add(reversedRate).div(2);
                        slippageRate = slippageRate.add(reversedSlippageRate).div(2);
                    } else {
                        expectedRate = 0;
                        slippageRate = 0;
                    }
                } else {
                    (expectedRate, slippageRate) = _getExpectedRateCall(
                        sourceTokenAddress,
                        destTokenAddress,
                        sourceTokenAmount,
                        false // saneRate
                    );
                }
            } else {
                expectedRate = 0;
                slippageRate = 0;
            }
        }
    }

    function _getExpectedRateCall(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        bool saneRate)
        internal
        view
        returns (uint256 expectedRate, uint256 slippageRate)
    {
        if (saneRate && sourceTokenAmount == 0) {
            uint256 sourceTokenDecimals = decimals[sourceTokenAddress];
            if (sourceTokenDecimals == 0)
                sourceTokenDecimals = EIP20(sourceTokenAddress).decimals();

            sourceTokenAmount = 10**(sourceTokenDecimals >= 2 ?
                sourceTokenDecimals-2 :
                sourceTokenDecimals
            );
        }

        (bool result, bytes memory data) = kyberContract.staticcall(
            abi.encodeWithSignature(
                "getExpectedRate(address,address,uint256)",
                sourceTokenAddress,
                destTokenAddress,
                requirePermissionedReserveForQuery ? sourceTokenAmount.add(2**255) : sourceTokenAmount
            )
        );

        assembly {
            switch result
            case 0 {
                expectedRate := 0
                slippageRate := 0
            }
            default {
                expectedRate := mload(add(data, 32))
                slippageRate := mload(add(data, 64))
            }
        }
    }

    function _getTradeTxnData(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        uint256 sourceTokenAmount,
        uint256 maxDestTokenAmount,
        uint256 minConversionRate)
        internal
        view
        returns (bytes memory)
    {
        uint256 maxSourceTokenAmount;
        if (maxDestTokenAmount < 10**28) {
            uint256 maxSrcAllowed = maxSourceAmountAllowed[sourceTokenAddress];
            (uint256 slippageRate,) = _getExpectedRate(
                sourceTokenAddress,
                destTokenAddress,
                sourceTokenAmount < maxSrcAllowed || maxSrcAllowed == 0 ?
                    sourceTokenAmount :
                    maxSrcAllowed,
                false // saneRate
            );
            if (slippageRate == 0) {
                return "";
            }

            uint256 sourceToDestPrecision = _getDecimalPrecision(sourceTokenAddress, destTokenAddress);

            maxSourceTokenAmount = maxDestTokenAmount
                .mul(sourceToDestPrecision)
                .div(slippageRate)
                .mul(11).div(10); // include 1% safety buffer
            if (maxSourceTokenAmount == 0) {
                return "";
            }

            // max can't exceed what we sent in
            if (maxSourceTokenAmount > sourceTokenAmount) {
                maxSourceTokenAmount = sourceTokenAmount;
            }
        } else {
            maxSourceTokenAmount = sourceTokenAmount;
        }

        return abi.encodeWithSignature(
            "tradeWithHint(address,uint256,address,address,uint256,uint256,address,bytes)",
            sourceTokenAddress,
            maxSourceTokenAmount,
            destTokenAddress,
            receiverAddress,
            maxDestTokenAmount,
            minConversionRate,
            feeWallet,
            requirePermissionedReserveForSwap ? "PERM" : "" // hint
        );
    }

    function _trade(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        address returnToSenderAddress,
        uint256 sourceTokenAmount,
        uint256 maxDestTokenAmount,
        uint256 minConversionRate)
        internal
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        if (sourceTokenAmount == 0 || maxDestTokenAmount == 0) {
            return (0,0);
        }

        if (sourceTokenAddress == destTokenAddress) {
            if (maxDestTokenAmount < sourceTokenAmount) {
                destTokenAmountReceived = maxDestTokenAmount;
                sourceTokenAmountUsed = maxDestTokenAmount;
            } else {
                destTokenAmountReceived = sourceTokenAmount;
                sourceTokenAmountUsed = sourceTokenAmount;
            }

            if (receiverAddress == returnToSenderAddress) {
                if (receiverAddress != address(this))
                    if (!_transferToken(
                        destTokenAddress,
                        receiverAddress,
                        sourceTokenAmount)) {
                        revert("BZxOracle::_trade: _transferToken failed");
                    }
            } else {
                if (receiverAddress != address(this))
                    if (!_transferToken(
                        destTokenAddress,
                        receiverAddress,
                        destTokenAmountReceived)) {
                        revert("BZxOracle::_trade: _transferToken failed");
                    }

                if (returnToSenderAddress != address(this))
                    if (sourceTokenAmountUsed < sourceTokenAmount) {
                        // send unused source token back
                        if (!_transferToken(
                            sourceTokenAddress,
                            returnToSenderAddress,
                            sourceTokenAmount-sourceTokenAmountUsed)) {
                            revert("BZxOracle::_trade: _transferToken failed");
                        }
                    }
            }
        } else {
            require(supportedTokens[sourceTokenAddress] && supportedTokens[destTokenAddress], "invalid tokens");

            bytes memory txnData = _getTradeTxnData(
                sourceTokenAddress,
                destTokenAddress,
                receiverAddress,
                sourceTokenAmount,
                maxDestTokenAmount,
                minConversionRate
            );

            if (txnData.length != 0) {
                // re-up the Kyber spend approval if needed
                uint256 tempAllowance = EIP20(sourceTokenAddress).allowance(address(this), kyberContract);
                if (tempAllowance < sourceTokenAmount) {
                    if (tempAllowance != 0) {
                        // reset approval to 0
                        eip20Approve(
                            sourceTokenAddress,
                            kyberContract,
                            0);
                    }

                    eip20Approve(
                        sourceTokenAddress,
                        kyberContract,
                        10**28);
                }

                uint256 sourceBalanceBefore = EIP20(sourceTokenAddress).balanceOf(address(this));

                /* the following code is to allow the Kyber trade to fail silently and not revert if it does, preventing a "bubble up" */
                (bool result, bytes memory data) = kyberContract.call.gas(gasleft())(txnData);

                assembly {
                    switch result
                    case 0 {
                        destTokenAmountReceived := 0
                    }
                    default {
                        destTokenAmountReceived := mload(add(data, 32))
                    }
                }

                sourceTokenAmountUsed = sourceBalanceBefore.sub(EIP20(sourceTokenAddress).balanceOf(address(this)));
                require(sourceTokenAmountUsed <= sourceTokenAmount, "too much sourceToken used");
            } else {
                destTokenAmountReceived = MAX_UINT;
            }

            if (returnToSenderAddress != address(this)) {
                if (sourceTokenAmountUsed < sourceTokenAmount) {
                    // send unused source token back
                    if (!_transferToken(
                        sourceTokenAddress,
                        returnToSenderAddress,
                        sourceTokenAmount-sourceTokenAmountUsed)
                    ) {
                        revert("BZxOracle::_trade: _transferToken failed");
                    }
                }
            }
        }
    }

    function _transferEther(
        address payable to,
        uint256 value)
        internal
        returns (bool)
    {
        uint256 amount = value;
        if (amount > address(this).balance) {
            amount = address(this).balance;
        }

        return (to.send(amount));
    }

    function _transferToken(
        address tokenAddress,
        address to,
        uint256 value)
        internal
        returns (bool)
    {
        eip20Transfer(
            tokenAddress,
            to,
            value);

        return true;
    }
}
