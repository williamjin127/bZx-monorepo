/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.8;
pragma experimental ABIEncoderV2;

import "./AdvancedTokenStorage.sol";


interface IBZxSettings {
    function pushLoanOrderOnChain(
        address[8] calldata orderAddresses,
        uint256[11] calldata orderValues,
        bytes calldata oracleData,
        bytes calldata signature)
        external
        returns (bytes32); // loanOrderHash

    function setLoanOrderDesc(
        bytes32 loanOrderHash,
        string calldata desc)
        external
        returns (bool);

    function oracleAddresses(
        address oracleAddress)
        external
        view
        returns (address);
}

interface IBZxOracleSettings {
    function tradeUserAsset(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        address returnToSenderAddress,
        uint256 sourceTokenAmount,
        uint256 maxDestTokenAmount,
        uint256 minConversionRate)
        external
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);
}

contract LoanTokenSettingsLowerAdmin is AdvancedTokenStorage {
    using SafeMath for uint256;

    struct LeverageParams {
        uint256 leverageAmount;
        uint256 initialMarginAmount;
        uint256 maintenanceMarginAmount;
        uint256 maxDurationUnixTimestampSec;
        uint256 marginPremiumAmount;
        address collateralTokenAddress;
    }

    modifier onlyAdmin() {
        address _lowerAdmin;
        //keccak256("iToken_LowerAdminAddress")
        assembly {
            _lowerAdmin := sload(0x7ad06df6a0af6bd602d90db766e0d5f253b45187c3717a0f9026ea8b10ff0d4b)
        }

        require(msg.sender == address(this) ||
            msg.sender == _lowerAdmin ||
            msg.sender == owner, "unauthorized");
        _;
    }

    function()
        external
    {
        revert("invalid");
    }

    function initLeverageBatch(
        LeverageParams[] memory leverageParamsArr,
        bool allowUpdate)
        public
        onlyAdmin
    {
        for (uint256 i=0; i < leverageParamsArr.length; i++) {
            LeverageParams memory leverageParams = leverageParamsArr[i];

            uint256 leverageAmount = leverageParams.collateralTokenAddress == address(0) ?
                leverageParams.leverageAmount :
                uint256(keccak256(abi.encodePacked(leverageParams.leverageAmount,leverageParams.collateralTokenAddress)));

            if (!allowUpdate && loanOrderHashes[leverageAmount] != 0) {
                continue;
            }

            address[8] memory orderAddresses = [
                address(this), // makerAddress
                loanTokenAddress, // loanTokenAddress
                loanTokenAddress, // interestTokenAddress (same as loanToken)
                leverageParams.collateralTokenAddress, // collateralTokenAddress
                address(0), // feeRecipientAddress
                bZxOracle, // (leave as original value)
                address(0), // takerAddress
                address(0) // tradeTokenAddress
            ];

            uint256[11] memory orderValues = [
                0, // loanTokenAmount
                0, // interestAmountPerDay
                leverageParams.initialMarginAmount, // initialMarginAmount,
                leverageParams.maintenanceMarginAmount, // maintenanceMarginAmount,
                0, // lenderRelayFee
                0, // traderRelayFee
                leverageParams.maxDurationUnixTimestampSec, // maxDurationUnixTimestampSec,
                0, // expirationUnixTimestampSec
                0, // makerRole (0 = lender)
                0, // withdrawOnOpen
                uint(keccak256(abi.encodePacked(msg.sender, block.timestamp))) // salt
            ];

            bytes32 loanOrderHash = IBZxSettings(bZxContract).pushLoanOrderOnChain(
                orderAddresses,
                orderValues,
                abi.encodePacked(address(this)), // oracleData -> closeLoanNotifier
                ""
            );
            IBZxSettings(bZxContract).setLoanOrderDesc(
                loanOrderHash,
                name
            );
            loanOrderData[loanOrderHash] = LoanData({
                loanOrderHash: loanOrderHash,
                leverageAmount: leverageParams.leverageAmount, // actutal leverage value
                initialMarginAmount: leverageParams.initialMarginAmount,
                maintenanceMarginAmount: leverageParams.maintenanceMarginAmount,
                maxDurationUnixTimestampSec: leverageParams.maxDurationUnixTimestampSec,
                index: leverageList.length,
                marginPremiumAmount: leverageParams.marginPremiumAmount, // applies for over-collateralized loans
                collateralTokenAddress: leverageParams.collateralTokenAddress
            });
            loanOrderHashes[leverageAmount] = loanOrderHash;
            leverageList.push(leverageAmount);
        }
    }

    function removeLeverageBatch(
        uint256[] memory leverageAmounts,
        address[] memory collateralTokenAddresses)
        public
        onlyAdmin
    {
        require(leverageAmounts.length == collateralTokenAddresses.length, "count mismatch");

        for (uint256 i=0; i < leverageAmounts.length; i++) {
            uint256 leverageAmount = leverageAmounts[i];
            address collateralTokenAddress = collateralTokenAddresses[i];

            leverageAmount = collateralTokenAddress == address(0) ?
                leverageAmount :
                uint256(keccak256(abi.encodePacked(leverageAmount,collateralTokenAddress)));

            bytes32 loanOrderHash = loanOrderHashes[leverageAmount];
            require(loanOrderHash != 0, "hash not found");

            if (leverageList.length > 1) {
                uint256 index = loanOrderData[loanOrderHash].index;
                leverageList[index] = leverageList[leverageList.length - 1];
                loanOrderData[loanOrderHashes[leverageList[index]]].index = index;
            }
            leverageList.length--;

            delete loanOrderHashes[leverageAmount];
            delete loanOrderData[loanOrderHash];
        }
    }

    // These params should be percentages represented like so: 5% = 5000000000000000000
    // rateMultiplier + baseRate can't exceed 100%
    function setDemandCurve(
        uint256 _baseRate,
        uint256 _rateMultiplier,
        uint256 _lowUtilBaseRate,
        uint256 _lowUtilRateMultiplier,
        uint256 _fixedInterestBaseRate,
        uint256 _fixedInterestRateMultiplier)
        public
        onlyAdmin
    {
        require(_rateMultiplier.add(_baseRate) <= 10**20, "");
        require(_lowUtilRateMultiplier.add(_lowUtilBaseRate) <= 10**20, "");
        require(_fixedInterestRateMultiplier.add(_fixedInterestBaseRate) <= 10**20, "");

        baseRate = _baseRate;
        rateMultiplier = _rateMultiplier;

        //keccak256("iToken_LowUtilBaseRate"), keccak256("iToken_LowUtilRateMultiplier")
        //keccak256("iToken_FixedInterestBaseRate"), keccak256("iToken_FixedInterestRateMultiplier")
        assembly {
            sstore(0x3d82e958c891799f357c1316ae5543412952ae5c423336f8929ed7458039c995, _lowUtilBaseRate)
            sstore(0x2b4858b1bc9e2d14afab03340ce5f6c81b703c86a0c570653ae586534e095fb1, _lowUtilRateMultiplier)

            sstore(0x185a40c6b6d3f849f72c71ea950323d21149c27a9d90f7dc5e5ea2d332edcf7f, _fixedInterestBaseRate)
            sstore(0x9ff54bc0049f5eab56ca7cd14591be3f7ed6355b856d01e3770305c74a004ea2, _fixedInterestRateMultiplier)
        }
    }

    function swapIntoLoanToken(
        address sourceTokenAddress,
        uint256 amount)
        public
        onlyAdmin
    {
        require(sourceTokenAddress != loanTokenAddress, "invalid token");

        address oracleAddress = IBZxSettings(bZxContract).oracleAddresses(bZxOracle);

        uint256 balance = ERC20(sourceTokenAddress).balanceOf(address(this));
        if (balance < amount)
            amount = balance;

        uint256 tempAllowance = ERC20(sourceTokenAddress).allowance(address(this), oracleAddress);
        if (tempAllowance < amount) {
            if (tempAllowance != 0) {
                // reset approval to 0
                require(ERC20(sourceTokenAddress).approve(oracleAddress, 0), "token approval reset failed");
            }

            require(ERC20(sourceTokenAddress).approve(oracleAddress, MAX_UINT), "token approval failed");
        }

        IBZxOracleSettings(oracleAddress).tradeUserAsset(
            sourceTokenAddress,
            loanTokenAddress,
            address(this),  // receiverAddress
            address(this),  // returnToSenderAddress
            amount,         // sourceTokenAmount
            MAX_UINT,       // maxDestTokenAmount
            0               // minConversionRate
        );
    }

    function wrapEther()
        public
        onlyAdmin
    {
        if (address(this).balance != 0) {
            WETHInterface(wethContract).deposit.value(address(this).balance)();
        }
    }

    // Sends non-LoanToken assets to the Oracle fund
    // These are assets that would otherwise be "stuck" due to a user accidently sending them to the contract
    function donateAsset(
        address tokenAddress)
        public
        onlyAdmin
        returns (bool)
    {
        if (tokenAddress == loanTokenAddress)
            return false;

        uint256 balance = ERC20(tokenAddress).balanceOf(address(this));
        if (balance == 0)
            return false;

        require(ERC20(tokenAddress).transfer(
            IBZxSettings(bZxContract).oracleAddresses(bZxOracle),
            balance
        ), "12");

        return true;
    }

    function toggleFunctionPause(
        string memory funcId,  // example: "mint(uint256,uint256)"
        bool isPaused)
        public
        onlyAdmin
    {
        // keccak256("iToken_FunctionPause")
        bytes32 slot = keccak256(abi.encodePacked(bytes4(keccak256(abi.encodePacked(funcId))), uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2)));
        assembly {
            sstore(slot, isPaused)
        }
    }
}
