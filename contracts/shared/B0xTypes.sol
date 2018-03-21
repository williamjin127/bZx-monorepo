
pragma solidity ^0.4.19;

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
        uint maintenanceMarginAmount;
        uint lenderRelayFee;
        uint traderRelayFee;
        uint expirationUnixTimestampSec;
        bytes32 loanOrderHash;
    }

    struct Loan {
        address lender;
        address collateralTokenFilled;
        uint collateralTokenAmountFilled;
        uint loanTokenAmountFilled;
        uint filledUnixTimestampSec;
        uint listPosition;
        bool active;
    }

    struct Position {
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


    event LogLoanOrder (
        address maker,
        address loanTokenAddress,
        address interestTokenAddress,
        address collateralTokenAddress,
        address feeRecipientAddress,
        address oracleAddress,
        uint loanTokenAmount,
        uint interestAmount,
        uint initialMarginAmount,
        uint maintenanceMarginAmount,
        uint lenderRelayFee,
        uint traderRelayFee,
        uint expirationUnixTimestampSec,
        bytes32 loanOrderHash
    );

    event LogLoan (
        address trader,
        address lender,
        address collateralTokenFilled,
        uint collateralTokenAmountFilled,
        uint loanTokenAmountFilled,
        uint filledUnixTimestampSec,
        uint listPosition,
        bool active,
        bytes32 loanOrderHash
    );

    event LogPosition (
        address tradeToken,
        uint tradeTokenAmount,
        uint loanTokenUsedAmount,
        uint filledUnixTimestampSec,
        uint listPosition,
        bool active
    );

    // for debugging, remove later
    event MarginCalc(
        address exposureTokenAddress,
        address collateralTokenAddress,
        address oracleAddress,
        uint exposureTokenAmount,
        uint collateralTokenAmount,
        uint marginAmount,
        uint rate,
        uint otherAmount
    );

    uint constant MAX_UINT = 2**256 - 1;

    function buildLoanOrderStruct(
        bytes32 loanOrderHash,
        address[6] addrs,
        uint[9] uints) 
        internal
        pure
        returns (LoanOrder) {

        return LoanOrder({
            maker: addrs[0],
            loanTokenAddress: addrs[1],
            interestTokenAddress: addrs[2],
            collateralTokenAddress: addrs[3],
            feeRecipientAddress: addrs[4],
            oracleAddress: addrs[5],
            loanTokenAmount: uints[0],
            interestAmount: uints[1],
            initialMarginAmount: uints[2],
            maintenanceMarginAmount: uints[3],
            lenderRelayFee: uints[4],
            traderRelayFee: uints[5],
            expirationUnixTimestampSec: uints[6],
            loanOrderHash: loanOrderHash
        });
    }

    function buildLoanStruct(
        address[2] addrs,
        uint[4] uints,
        bool boolean)
        internal
        pure
        returns (Loan) {

        return Loan({
            lender: addrs[0],
            collateralTokenFilled: addrs[1],
            collateralTokenAmountFilled: uints[0],
            loanTokenAmountFilled: uints[1],
            filledUnixTimestampSec: uints[2],
            listPosition: uints[3],
            active: boolean
        });
    }

    function buildPositionStruct(
        address addr,
        uint[4] uints,
        bool boolean)
        internal
        pure
        returns (Position) {

        return Position({
            tradeTokenAddress: addr,
            tradeTokenAmount: uints[0],
            loanTokenUsedAmount: uints[1],
            filledUnixTimestampSec: uints[2],
            listPosition: uints[3],
            active: boolean
        });
    }

    /*
     * Unused Functions (remove later)
     */

    /*function getLoanOrderFromBytes(
        bytes loanOrderData)
        internal
        pure
        returns (LoanOrder) 
    {
        uint i;

        // handles address
        address[6] memory addrs;
        for(i = 1; i <= addrs.length; i++) {
            address tmpAddr;
            assembly {
                tmpAddr := mload(add(loanOrderData, mul(i, 32)))
            }
            addrs[i-1] = tmpAddr;
        }

        // handles uint
        uint[9] memory uints;
        for(i = addrs.length+1; i <= addrs.length+uints.length; i++) {
            uint tmpUint;
            assembly {
                tmpUint := mload(add(loanOrderData, mul(i, 32)))
            }
            uints[i-1-addrs.length] = tmpUint;
        }

        // handles bytes32
        bytes32 loanOrderHash;
        i = addrs.length + uints.length + 1;
        assembly {
            loanOrderHash := mload(add(loanOrderData, mul(i, 32)))
        }
        
        return buildLoanOrderStruct(loanOrderHash, addrs, uints);
    }

    function getLoanFromBytes(
        bytes loanData)
        internal
        pure
        returns (Loan) 
    {
        var (lender, uints, active) = getLoanOrPositionPartsFromBytes(loanData);
        
        return buildLoanStruct(lender, uints, active);
    }

    function getPositionFromBytes(
        bytes tradeData)
        internal
        pure
        returns (Position) 
    {
        var (tradeTokenAddress, uints, active) = getLoanOrPositionPartsFromBytes(tradeData);
        
        return buildPositionStruct(tradeTokenAddress, uints, active);
    }

    function getLoanOrPositionPartsFromBytes(
        bytes data)
        internal
        pure
        returns (address, uint[4], bool) 
    {
        uint i;

        // handles address
        address addrVal;
        assembly {
            addrVal := mload(add(data, 32))
        }

        // handles uint
        uint[4] memory uints;
        for(i = 2; i <= uints.length+1; i++) {
            uint tmpUint;
            assembly {
                tmpUint := mload(add(data, mul(i, 32)))
            }
            uints[i-2] = tmpUint;
        }

        // handles bool
        bool boolVal;
        i = uints.length + 2;
        assembly {
            boolVal := mload(add(data, mul(i, 32)))
        }

        return (addrVal, uints, boolVal);
    }

    function getLoanOrderBytes (
        bytes32 loanOrderHash,
        address[6] addrs,
        uint[9] uints)
        public
        pure
        returns (bytes)
    {
        uint size = (addrs.length + uints.length + 1) * 32;
        bytes memory data = new bytes(size);

        uint i;

        // handles address
        for(i = 1; i <= addrs.length; i++) {
            address tmpAddr = addrs[i-1];
            assembly {
                mstore(add(data, mul(i, 32)), tmpAddr)
            }
        }

        // handles uint
        for(i = addrs.length+1; i <= addrs.length+uints.length; i++) {
            uint tmpUint = uints[i-1-addrs.length];
            assembly {
                mstore(add(data, mul(i, 32)), tmpUint)
            }
        }

        // handles bytes32
        i = addrs.length + uints.length + 1;
        assembly {
            mstore(add(data, mul(i, 32)), loanOrderHash)
        }
        
        return data;
    }

    function getLoanBytes (
        address lender,
        uint[4] uints,
        bool active)
        public
        pure
        returns (bytes)
    {
        uint size = (uints.length + 2) * 32;
        bytes memory data = new bytes(size);

        uint i;

        // handles address
        i = 1;
        assembly {
            mstore(add(data, mul(i, 32)), lender)
        }

        // handles uint
        for(i = 2; i <= uints.length+1; i++) {
            uint tmpUint = uints[i-2];
            assembly {
                mstore(add(data, mul(i, 32)), tmpUint)
            }
        }

        // handles bool
        i = uints.length + 2;
        assembly {
            mstore(add(data, mul(i, 32)), active)
        }
        
        return data;
    }

    function getPositionBytes (
        address tradeTokenAddress,
        uint[4] uints,
        bool active)
        public
        pure
        returns (bytes)
    {
        uint size = (uints.length + 2) * 32;
        bytes memory data = new bytes(size);

        uint i;

        // handles address
        i = 1;
        assembly {
            mstore(add(data, mul(i, 32)), tradeTokenAddress)
        }

        // handles uint
        for(i = 2; i <= uints.length+1; i++) {
            uint tmpUint = uints[i-2];
            assembly {
                mstore(add(data, mul(i, 32)), tmpUint)
            }
        }

        // handles bool
        i = uints.length + 2;
        assembly {
            mstore(add(data, mul(i, 32)), active)
        }
        
        return data;
    }*/
}
