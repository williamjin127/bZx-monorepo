/**
 * Copyright 2017-2019, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.8;
pragma experimental ABIEncoderV2;

import "./BZxBridge.sol";


library Account {
    struct Info {
        address owner;
        uint256 number;
    }
}

library Types {
    struct Wei {
        bool sign; // true if positive
        uint256 value;
    }

    enum AssetDenomination {
        Wei, // the amount is denominated in wei
        Par  // the amount is denominated in par
    }

    enum AssetReference {
        Delta, // the amount is given as a delta from the current value
        Target // the amount is given as an exact number to end up at
    }

    struct AssetAmount {
        bool sign; // true if positive
        AssetDenomination denomination;
        AssetReference ref;
        uint256 value;
    }
}

library Actions {
    enum ActionType {
        Deposit,   // supply tokens
        Withdraw  // borrow tokens
    }

    struct ActionArgs {
        ActionType actionType;
        uint256 accountId;
        Types.AssetAmount amount;
        uint256 primaryMarketId;
        uint256 secondaryMarketId;
        address otherAddress;
        uint256 otherAccountId;
        bytes data;
    }
}

contract SoloMargin {
    function getIsLocalOperator(address owner, address operator) public view returns (bool);
    function getAccountWei(Account.Info memory account, uint256 marketId) public view returns (Types.Wei memory);

    function operate(Account.Info[] memory accounts, Actions.ActionArgs[] memory actions) public;
}

contract SoloBridge is BZxBridge
{
    SoloMargin sm;
    mapping(uint => address) public iTokens; // Solo market id => iToken

    event NewToken(uint marketId, address iToken);

    constructor(address soloMargin, uint[] memory marketIds, address[] memory _iTokens) public {
        sm = SoloMargin(soloMargin);
        setTokens(marketIds, _iTokens);
    }

    function migrateLoan(
        Account.Info calldata account,
        uint marketId, // Solo market id
        uint loanAmount, // the amount of underlying tokens being migrated
        uint[] calldata marketIds, // collateral market ids
        uint[] calldata amounts, // collateral amounts to migrate
        uint[] calldata collateralAmounts // will be used for borrow on bZx
    )
        external
    {
        require(loanAmount > 0, "Invalid loan amount");
        require(marketIds.length > 0, "Invalid markets");
        require(marketIds.length == amounts.length, "Invalid amounts");
        require(amounts.length == collateralAmounts.length, "Invalid collateral amounts");

        require(sm.getIsLocalOperator(msg.sender, address(this)), "Bridge is not an operator");

        Types.Wei memory accountWei = sm.getAccountWei(account, marketId);
        require(!accountWei.sign && accountWei.value >= loanAmount, "Invalid Solo balance");

        LoanTokenInterface iToken = LoanTokenInterface(iTokens[marketId]);

        bytes memory data = abi.encodeWithSignature(
            "_migrateLoan(address,uint256,uint256,uint256,uint256[],uint256[],uint256[])",
            msg.sender, account.number, marketId, loanAmount, marketIds, amounts, collateralAmounts
        );

        iToken.flashBorrowToken(loanAmount, address(this), address(this), "", data);
    }

    function _migrateLoan(
        address borrower,
        uint account,
        uint marketId,
        uint loanAmount,
        uint[] calldata marketIds,
        uint[] calldata amounts,
        uint[] calldata collateralAmounts
    )
        external
    {
        LoanTokenInterface iToken = LoanTokenInterface(iTokens[marketId]);

        Account.Info[] memory accounts = new Account.Info[](1);
        accounts[0] = Account.Info(borrower, account);

        bytes memory data;
        address loanTokenAddress = iToken.loanTokenAddress();

        ERC20(loanTokenAddress).approve(address(sm), loanAmount);

        Actions.ActionArgs[] memory actions = new Actions.ActionArgs[](marketIds.length + 1);
        actions[0] = Actions.ActionArgs({
            actionType: Actions.ActionType.Deposit,
            amount: Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: loanAmount
            }),
            primaryMarketId: marketId,
            otherAddress: address(this),
            accountId: 0,
            secondaryMarketId: 0,
            otherAccountId: 0,
            data: data
        });

        for (uint i = 0; i < marketIds.length; i++) {
            actions[i + 1] = Actions.ActionArgs({
                actionType: Actions.ActionType.Withdraw,
                amount: Types.AssetAmount({
                    sign: false,
                    denomination: Types.AssetDenomination.Wei,
                    ref: Types.AssetReference.Delta,
                    value: amounts[i]
                }),
                primaryMarketId: marketIds[i],
                otherAddress: address(this),
                accountId: 0,
                secondaryMarketId: 0,
                otherAccountId: 0,
                data: data
            });
        }

        sm.operate(accounts, actions);

        address _borrower = borrower;
        for (uint i = 0; i < marketIds.length; i++) {
            requireThat(collateralAmounts[i] <= amounts[i], "Collateral amount exceeds total value", i);

            uint market = marketIds[i];
            uint amount = amounts[i];
            uint collateralAmount = collateralAmounts[i];
            LoanTokenInterface iCollateral = LoanTokenInterface(iTokens[market]);
            address underlying = iCollateral.loanTokenAddress();

            ERC20(underlying).approve(address(iToken), collateralAmount);

            iToken.borrowTokenFromDeposit(
                0,
                leverageAmount,
                initialLoanDuration,
                collateralAmount,
                address(this), // TODO @bshevchenko: bridge should be only a receiver
                underlying,
                loanData
            );

            uint excess = amount - collateralAmount;
            if (excess > 0) {
                ERC20(underlying).approve(address(iCollateral), excess);
                iCollateral.mint(_borrower, excess);
            }
        }

        // repaying flash borrow
        ERC20(loanTokenAddress).transfer(address(iToken), loanAmount);
    }

    function setTokens(uint[] memory marketIds, address[] memory _iTokens) public onlyOwner
    {
        require(marketIds.length == _iTokens.length);

        for (uint i = 0; i < marketIds.length; i++) {
            iTokens[marketIds[i]] = _iTokens[i];
            emit NewToken(marketIds[i], _iTokens[i]);
        }
    }
}
