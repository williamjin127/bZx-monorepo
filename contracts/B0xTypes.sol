pragma solidity ^0.4.9;

contract B0xTypes {
    
    struct LoanOrder {
        address maker;
        address loanTokenAddress;
        address interestTokenAddress;
        address collateralTokenAddress;
        address feeRecipientAddress;
        address oracleAddress;
        uint loanTokenAmount;
        uint interestAmount;
        uint initialMarginAmount;
        uint liquidationMarginAmount;
        uint lenderRelayFee;
        uint traderRelayFee;
        uint expirationUnixTimestampSec;
        bytes32 orderHash;
    }

    struct Loan {
        address lender;
        uint collateralTokenAddressAmountFilled;
        uint loanTokenAmountFilled;
        uint filledUnixTimestampSec;
        uint listPosition;
        bool active;
    }

    struct Trade {
        address tradeTokenAddress;
        uint tradeTokenAmount;
        uint loanTokenUsedAmount;
        uint filledUnixTimestampSec;
        uint listPosition;
        bool active;
    }

    struct InterestData {
        address lender;
        address interestTokenAddress;
        uint totalAmountAccrued;
        uint interestPaidSoFar;
    }

    /*struct RateData {
        uint marginToLendRate;
        uint tradeToMarginRate;
    }*/
}
