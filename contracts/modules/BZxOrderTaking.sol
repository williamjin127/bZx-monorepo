
pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/Math.sol";

import "./BZxStorage.sol";
import "./BZxProxyContracts.sol";
import "../shared/InternalFunctions.sol";

import "../BZxVault.sol";
import "../oracle/OracleRegistry.sol";
import "../oracle/OracleInterface.sol";


contract BZxOrderTaking is BZxStorage, Proxiable, InternalFunctions {
    using SafeMath for uint256;

    // Allowed 0x signature types.
    enum SignatureType {
        Illegal,         // 0x00, default value
        Invalid,         // 0x01
        EIP712,          // 0x02
        EthSign,         // 0x03
        Caller,          // 0x04
        Wallet,          // 0x05
        Validator,       // 0x06
        PreSigned,       // 0x07
        Trezor,          // 0x08
        NSignatureTypes  // 0x09, number of signature types. Always leave at end.
    }

    constructor() public {}

    function initialize(
        address _target)
        public
        onlyOwner
    {
        targets[0x8fbbe7a2] = _target; // bytes4(keccak256("takeLoanOrderAsTrader(address[6],uint256[9],address,uint256,bytes)"))
        targets[0x30769736] = _target; // bytes4(keccak256("takeLoanOrderAsLender(address[6],uint256[9],bytes)"))
        targets[0xde5d838e] = _target; // bytes4(keccak256("cancelLoanOrder(address[6],uint256[9],uint256)"))
        targets[0x8c0a1d7c] = _target; // bytes4(keccak256("cancelLoanOrder(bytes32,uint256)"))
        targets[0x03efed44] = _target; // bytes4(keccak256("getLoanOrderHash(address[6],uint256[9])"))
        targets[0x238a4d1e] = _target; // bytes4(keccak256("isValidSignature(address,bytes32,bytes)"))
        targets[0x8823d53c] = _target; // bytes4(keccak256("getInitialCollateralRequired(address,address,address,uint256,uint256)"))
        targets[0x08e3857c] = _target; // bytes4(keccak256("getUnavailableLoanTokenAmount(bytes32)"))
        targets[0xd8c73360] = _target; // bytes4(keccak256("getSingleOrder(bytes32)"))
        targets[0x27b62ad9] = _target; // bytes4(keccak256("getOrders(address,uint256,uint256)"))
        targets[0x49bd01ca] = _target; // bytes4(keccak256("getSingleLoan(bytes32,address)"))
        targets[0x512e5f9b] = _target; // bytes4(keccak256("getLoansForLender(address,uint256,bool)"))
        targets[0x9974d431] = _target; // bytes4(keccak256("getLoansForTrader(address,uint256,bool)"))
        targets[0x982260bc] = _target; // bytes4(keccak256("getActiveLoans(uint256,uint256)"))
    }

    /// @dev Takes the order as trader
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param collateralTokenFilled Desired address of the collateralTokenAddress the trader wants to use.
    /// @param loanTokenAmountFilled Desired amount of loanToken the trader wants to borrow.
    /// @param signature ECDSA signature in raw bytes (rsv).
    /// @return Total amount of loanToken borrowed (uint).
    /// @dev Traders can take a portion of the total coin being lended (loanTokenAmountFilled).
    /// @dev Traders also specify the token that will fill the margin requirement if they are taking the order.
    function takeLoanOrderAsTrader(
        address[6] orderAddresses,
        uint[9] orderValues,
        address collateralTokenFilled,
        uint loanTokenAmountFilled,
        bytes signature)
        external
        nonReentrant
        tracksGas
        returns (uint)
    {
        return _takeLoanOrder(
            orderAddresses,
            orderValues,
            collateralTokenFilled,
            loanTokenAmountFilled,
            signature,
            1 // takerRole
        );
    }

    /// @dev Takes the order as lender
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param signature ECDSA signature in raw bytes (rsv).
    /// @return Total amount of loanToken borrowed (uint).
    /// @dev Lenders have to fill the entire desired amount the trader wants to borrow.
    /// @dev This makes loanTokenAmountFilled = loanOrder.loanTokenAmount.
    function takeLoanOrderAsLender(
        address[6] orderAddresses,
        uint[9] orderValues,
        bytes signature)
        external
        nonReentrant
        tracksGas
        returns (uint)
    {
        return _takeLoanOrder(
            orderAddresses,
            orderValues,
            orderAddresses[3], // collateralTokenFilled
            orderValues[0], // loanTokenAmountFilled
            signature,
            0 // takerRole
        );
    }

    /// @dev Cancels remaining (untaken) loan
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @param cancelLoanTokenAmount The amount of remaining unloaned token to cancel.
    /// @return The amount of loan token canceled.
    function cancelLoanOrder(
        address[6] orderAddresses,
        uint[9] orderValues,
        uint cancelLoanTokenAmount)
        external
        nonReentrant
        tracksGas
        returns (uint)
    {
        return _cancelLoanOrder(
            getLoanOrderHash(orderAddresses, orderValues), 
            cancelLoanTokenAmount
        );
    }

    /// @dev Cancels remaining (untaken) loan
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @param cancelLoanTokenAmount The amount of remaining unloaned token to cancel.
    /// @return The amount of loan token canceled.
    function cancelLoanOrder(
        bytes32 loanOrderHash,
        uint cancelLoanTokenAmount)
        external
        nonReentrant
        tracksGas
        returns (uint)
    {
        return _cancelLoanOrder(
            loanOrderHash, 
            cancelLoanTokenAmount
        );
    }

    /// @dev Calculates Keccak-256 hash of order with specified parameters.
    /// @param orderAddresses Array of order's makerAddress, loanTokenAddress, interestTokenAddress, collateralTokenAddress, feeRecipientAddress, oracleAddress.
    /// @param orderValues Array of order's loanTokenAmount, interestAmount, initialMarginAmount, maintenanceMarginAmount, lenderRelayFee, traderRelayFee, expirationUnixTimestampSec, makerRole (0=lender, 1=trader), and salt.
    /// @return Keccak-256 hash of loanOrder.
    function getLoanOrderHash(
        address[6] orderAddresses,
        uint[9] orderValues)
        public
        view
        returns (bytes32)
    {
        return(keccak256(abi.encodePacked(
            address(this),
            orderAddresses,
            orderValues
        )));
    }

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
        returns (bool)
    {
        return _isValidSignature(
            signer,
            hash,
            signature);
    }

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
        returns (uint collateralTokenAmount)
    {
        collateralTokenAmount = _getInitialCollateralRequired(
            loanTokenAddress,
            collateralTokenAddress,
            oracleAddress,
            loanTokenAmountFilled,
            initialMarginAmount);
    }

    /// @dev Calculates the sum of values already filled and cancelled for a given loanOrder.
    /// @param loanOrderHash A unique hash representing the loan order.
    /// @return Sum of values already filled and cancelled.
    function getUnavailableLoanTokenAmount(bytes32 loanOrderHash)
        public
        view
        returns (uint)
    {
        return orderFilledAmounts[loanOrderHash].add(orderCancelledAmounts[loanOrderHash]);
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
        if (loanOrder.maker == address(0)) {
            return;
        }

        // all encoded params will be zero-padded to 32 bytes
        bytes memory data = abi.encode(
            loanOrder.maker,
            loanOrder.loanTokenAddress,
            loanOrder.interestTokenAddress,
            loanOrder.collateralTokenAddress,
            loanOrder.feeRecipientAddress,
            oracleAddresses[loanOrder.oracleAddress],
            loanOrder.loanTokenAmount,
            loanOrder.interestAmount,
            loanOrder.initialMarginAmount,
            loanOrder.maintenanceMarginAmount,
            loanOrder.lenderRelayFee,
            loanOrder.traderRelayFee,
            loanOrder.expirationUnixTimestampSec,
            loanOrder.loanOrderHash
        );
        return _addExtraOrderData(loanOrder.loanOrderHash, data);
    }

    /// @dev Returns a bytestream of order data for a user.
    /// @param loanParty The address of the maker or taker of the order.
    /// @param start The starting order in the order list to return.
    /// @param count The total amount of orders to return if they exist. Amount returned can be less.
    /// @return A concatenated stream of bytes.
    function getOrders(
        address loanParty,
        uint start,
        uint count)
        public
        view
        returns (bytes)
    {
        uint end = Math.min256(orderList[loanParty].length, start.add(count));
        if (end == 0 || start >= end) {
            return;
        }

        // all encoded params will be zero-padded to 32 bytes
        bytes memory data;

        for (uint j=end-start; j > 0; j--) {
            LoanOrder memory loanOrder = orders[orderList[loanParty][j+start-1]];

            bytes memory tmpBytes = abi.encode(
                loanOrder.maker,
                loanOrder.loanTokenAddress,
                loanOrder.interestTokenAddress,
                loanOrder.collateralTokenAddress,
                loanOrder.feeRecipientAddress,
                oracleAddresses[loanOrder.oracleAddress],
                loanOrder.loanTokenAmount,
                loanOrder.interestAmount,
                loanOrder.initialMarginAmount,
                loanOrder.maintenanceMarginAmount,
                loanOrder.lenderRelayFee,
                loanOrder.traderRelayFee,
                loanOrder.expirationUnixTimestampSec,
                loanOrder.loanOrderHash
            );
            tmpBytes = _addExtraOrderData(loanOrder.loanOrderHash, tmpBytes);
            if (j == end-start) {
                data = tmpBytes;
            } else {
                data = abi.encodePacked(data, tmpBytes);
            }
        }

        return data;
    }

    /// @dev Returns a bytestream of loan data for a lender.
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
        LoanPosition memory loanPosition = loanPositions[loanOrderHash][trader];
        if (loanPosition.loanTokenAmountFilled == 0) {
            return;
        }

        // all encoded params will be zero-padded to 32 bytes
        bytes memory data = abi.encode(
            loanPosition.lender,
            loanPosition.trader,
            loanPosition.collateralTokenAddressFilled,
            loanPosition.positionTokenAddressFilled,
            loanPosition.loanTokenAmountFilled,
            loanPosition.collateralTokenAmountFilled,
            loanPosition.positionTokenAmountFilled,
            loanPosition.loanStartUnixTimestampSec,
            loanPosition.index,
            loanPosition.active
        );
        return _addExtraLoanData(
            loanOrderHash,
            loanPosition,
            data,
            false);
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
    /// @return A concatenated stream of LoanRef(loanOrderHash, trader) bytes.
    function getActiveLoans(
        uint start,
        uint count)
        public
        view
        returns (bytes)
    {
        uint end = Math.min256(loanList.length, start.add(count));
        if (end == 0 || start >= end) {
            return;
        }

        // all encoded params will be zero-padded to 32 bytes
        bytes memory data;

        for (uint j=0; j < end-start; j++) {
            LoanRef memory loanRef = loanList[j+start];
            LoanOrder memory loanOrder = orders[loanRef.loanOrderHash];

            bytes memory tmpBytes = abi.encode(
                loanRef.loanOrderHash,
                loanRef.trader,
                loanOrder.expirationUnixTimestampSec
            );
            if (j == 0) {
                data = tmpBytes;
            } else {
                data = abi.encodePacked(data, tmpBytes);
            }
        }

        return data;
    }

    /*
    * Internal functions
    */
    function _takeLoanOrder(
        address[6] orderAddresses,
        uint[9] orderValues,
        address collateralTokenFilled,
        uint loanTokenAmountFilled,
        bytes signature,
        uint takerRole) // (0=lender, 1=trader)
        internal
        returns (uint)
    {
        address lender;
        address trader;
        if (takerRole == 1) { // trader
            lender = orderAddresses[0]; // maker
            trader = msg.sender;
        } else { // lender
            lender = msg.sender;
            trader = orderAddresses[0]; // maker
        }

        bytes32 loanOrderHash = getLoanOrderHash(orderAddresses, orderValues);
        LoanOrder memory loanOrder = orders[loanOrderHash];

        if (loanOrder.maker == address(0)) {
            // no previous partial loan fill
            loanOrder = buildLoanOrderStruct(loanOrderHash, orderAddresses, orderValues);
            orders[loanOrder.loanOrderHash] = loanOrder;
            
            orderList[lender].push(loanOrder.loanOrderHash);
            orderLender[loanOrder.loanOrderHash] = lender;
        }

        orderList[trader].push(loanOrder.loanOrderHash);
        orderTraders[loanOrder.loanOrderHash].push(trader);
        
        loanList.push(LoanRef({
            loanOrderHash: loanOrder.loanOrderHash,
            trader: trader
        }));

        if (!_isValidSignature(
            loanOrder.maker,
            loanOrder.loanOrderHash,
            signature
        )) {
            revert("BZxOrderTaking::_takeLoanOrder: signature invalid");
        }

        // makerRole (orderValues[7]) and takerRole must not be equal and must have a value <= 1
        if (orderValues[7] > 1 || takerRole > 1 || orderValues[7] == takerRole) {
            revert("BZxOrderTaking::_takeLoanOrder: orderValues[7] > 1 || takerRole > 1 || orderValues[7] == takerRole");
        }

        // A trader can only fill a portion or all of a loanOrder once:
        //  - this avoids complex interest payments for parts of an order filled at different times by the same trader
        //  - this avoids potentially large loops when calculating margin reqirements and interest payments
        LoanPosition storage loanPosition = loanPositions[loanOrder.loanOrderHash][trader];
        if (loanPosition.loanTokenAmountFilled != 0) {
            revert("BZxOrderTaking::_takeLoanOrder: loanPosition.loanTokenAmountFilled != 0");
        }     

        uint collateralTokenAmountFilled = _fillLoanOrder(
            loanOrder,
            trader,
            lender,
            collateralTokenFilled,
            loanTokenAmountFilled
        );

        orderFilledAmounts[loanOrder.loanOrderHash] = orderFilledAmounts[loanOrder.loanOrderHash].add(loanTokenAmountFilled);

        loanPosition.lender = lender;
        loanPosition.trader = trader;
        loanPosition.collateralTokenAddressFilled = collateralTokenFilled;
        loanPosition.positionTokenAddressFilled = loanOrder.loanTokenAddress;
        loanPosition.loanTokenAmountFilled = loanTokenAmountFilled;
        loanPosition.collateralTokenAmountFilled = collateralTokenAmountFilled;
        loanPosition.positionTokenAmountFilled = loanTokenAmountFilled;
        loanPosition.loanStartUnixTimestampSec = block.timestamp;
        loanPosition.index = loanList.length-1;
        loanPosition.active = true;

        emit LogLoanTaken (
            loanPosition.lender,
            loanPosition.trader,
            loanPosition.collateralTokenAddressFilled,
            loanPosition.positionTokenAddressFilled,
            loanPosition.loanTokenAmountFilled,
            loanPosition.collateralTokenAmountFilled,
            loanPosition.positionTokenAmountFilled,
            loanPosition.loanStartUnixTimestampSec,
            loanPosition.active,
            loanOrder.loanOrderHash
        );

        if (collateralTokenAmountFilled > 0) {
            if (! OracleInterface(oracleAddresses[loanOrder.oracleAddress]).didTakeOrder(
                loanOrder.loanOrderHash,
                msg.sender,
                gasUsed // initial used gas, collected in modifier
            )) {
                revert("BZxOrderTaking::_takeLoanOrder: OracleInterface.didTakeOrder failed");
            }
        }

        return loanTokenAmountFilled;
    }

    function _fillLoanOrder(
        LoanOrder loanOrder,
        address trader,
        address lender,
        address collateralTokenFilled,
        uint loanTokenAmountFilled)
        internal
        returns (uint)
    {
        if (!_verifyLoanOrder(loanOrder, collateralTokenFilled, loanTokenAmountFilled)) {
            revert("BZxOrderTaking::_fillLoanOrder: loan verification failed");
        }

        uint collateralTokenAmountFilled = _getInitialCollateralRequired(
            loanOrder.loanTokenAddress,
            collateralTokenFilled,
            oracleAddresses[loanOrder.oracleAddress],
            loanTokenAmountFilled,
            loanOrder.initialMarginAmount
        );
        if (collateralTokenAmountFilled == 0) {
            revert("BZxOrderTaking::_fillLoanOrder: collateralTokenAmountFilled == 0");
        }

        // deposit collateral token
        if (! BZxVault(vaultContract).depositToken(
            collateralTokenFilled,
            trader,
            collateralTokenAmountFilled
        )) {
            revert("BZxOrderTaking::_fillLoanOrder: BZxVault.depositToken collateral failed");
        }

        // total interest required if loan is kept until order expiration
        // unused interest at the end of a loan is refunded to the trader
        uint totalInterestRequired = _getTotalInterestRequired(
            loanOrder.loanTokenAmount,
            loanTokenAmountFilled,
            loanOrder.interestAmount,
            loanOrder.expirationUnixTimestampSec,
            block.timestamp);

        // deposit interest token
        if (! BZxVault(vaultContract).depositToken(
            loanOrder.interestTokenAddress,
            trader,
            totalInterestRequired
        )) {
            revert("BZxOrderTaking::_fillLoanOrder: BZxVault.depositToken interest failed");
        }

        // deposit loan token
        if (! BZxVault(vaultContract).depositToken(
            loanOrder.loanTokenAddress,
            lender,
            loanTokenAmountFilled
        )) {
            revert("BZxOrderTaking::_fillLoanOrder: BZxVault.depositToken loan failed");
        }

        if (loanOrder.feeRecipientAddress != address(0)) {
            if (loanOrder.traderRelayFee > 0) {
                uint paidTraderFee = _getPartialAmountNoError(loanTokenAmountFilled, loanOrder.loanTokenAmount, loanOrder.traderRelayFee);
                
                if (! BZxVault(vaultContract).transferTokenFrom(
                    bZRxTokenContract, 
                    trader,
                    loanOrder.feeRecipientAddress,
                    paidTraderFee
                )) {
                    revert("BZxOrderTaking::_fillLoanOrder: BZxVault.transferTokenFrom traderRelayFee failed");
                }
            }
            if (loanOrder.lenderRelayFee > 0) {
                uint paidLenderFee = _getPartialAmountNoError(loanTokenAmountFilled, loanOrder.loanTokenAmount, loanOrder.lenderRelayFee);
                
                if (! BZxVault(vaultContract).transferTokenFrom(
                    bZRxTokenContract, 
                    lender,
                    loanOrder.feeRecipientAddress,
                    paidLenderFee
                )) {
                    revert("BZxOrderTaking::_fillLoanOrder: BZxVault.transferTokenFrom lenderRelayFee failed");
                }
            }
        }

        return collateralTokenAmountFilled;
    }

    // this cancels any reminaing un-loaned loanToken in the order
    function _cancelLoanOrder(
        bytes32 loanOrderHash,
        uint cancelLoanTokenAmount)
        internal
        returns (uint)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (loanOrder.maker == address(0)) {
            revert("BZxOrderTaking::cancelLoanOrder: loanOrder.maker == address(0)");
        }

        require(loanOrder.maker == msg.sender, "BZxOrderTaking::_cancelLoanOrder: loanOrder.maker != msg.sender");
        require(loanOrder.loanTokenAmount > 0 && cancelLoanTokenAmount > 0, "BZxOrderTaking::_cancelLoanOrder: invalid params");

        if (block.timestamp >= loanOrder.expirationUnixTimestampSec) {
            return 0;
        }

        uint remainingLoanTokenAmount = loanOrder.loanTokenAmount.sub(getUnavailableLoanTokenAmount(loanOrder.loanOrderHash));
        uint cancelledLoanTokenAmount = Math.min256(cancelLoanTokenAmount, remainingLoanTokenAmount);
        if (cancelledLoanTokenAmount == 0) {
            // none left to cancel
            return 0;
        }

        orderCancelledAmounts[loanOrder.loanOrderHash] = orderCancelledAmounts[loanOrder.loanOrderHash].add(cancelledLoanTokenAmount);

        emit LogLoanCancelled(
            msg.sender,
            cancelledLoanTokenAmount,
            (remainingLoanTokenAmount - cancelledLoanTokenAmount),
            loanOrder.loanOrderHash
        );
    
        return cancelledLoanTokenAmount;
    }

    function _verifyLoanOrder(
        LoanOrder loanOrder,
        address collateralTokenFilled,
        uint loanTokenAmountFilled)
        internal
        view
        returns (bool)
    {
        if (loanOrder.maker == msg.sender) {
            revert("BZxOrderTaking::_verifyLoanOrder: loanOrder.maker == msg.sender");
        }
        if (loanOrder.loanTokenAddress == address(0) 
            || loanOrder.interestTokenAddress == address(0)
            || collateralTokenFilled == address(0)) {
            revert("BZxOrderTaking::_verifyLoanOrder: loanOrder.loanTokenAddress == address(0) || loanOrder.interestTokenAddress == address(0) || collateralTokenFilled == address(0)");
        }

        if (loanTokenAmountFilled > loanOrder.loanTokenAmount) {
            revert("BZxOrderTaking::_verifyLoanOrder: loanTokenAmountFilled > loanOrder.loanTokenAmount");
        }

        if (! OracleRegistry(oracleRegistryContract).hasOracle(loanOrder.oracleAddress) || oracleAddresses[loanOrder.oracleAddress] == address(0)) {
            revert("BZxOrderTaking::_verifyLoanOrder: Oracle doesn't exist");
        }

        if (block.timestamp >= loanOrder.expirationUnixTimestampSec) {
            //LogError(uint8(Errors.ORDER_EXPIRED), 0, loanOrder.loanOrderHash);
            revert("BZxOrderTaking::_verifyLoanOrder: block.timestamp >= loanOrder.expirationUnixTimestampSec");
        }

        if (loanOrder.maintenanceMarginAmount == 0 || loanOrder.maintenanceMarginAmount >= loanOrder.initialMarginAmount) {
            revert("BZxOrderTaking::_verifyLoanOrder: loanOrder.maintenanceMarginAmount == 0 || loanOrder.maintenanceMarginAmount >= loanOrder.initialMarginAmount");
        }

        uint remainingLoanTokenAmount = loanOrder.loanTokenAmount.sub(getUnavailableLoanTokenAmount(loanOrder.loanOrderHash));
        if (remainingLoanTokenAmount < loanTokenAmountFilled) {
            revert("BZxOrderTaking::_verifyLoanOrder: remainingLoanTokenAmount < loanTokenAmountFilled");
        }

        return true;
    }

    function _addExtraOrderData(
        bytes32 loanOrderHash,
        bytes data)
        internal
        view
        returns (bytes)
    {
        bytes memory tmpBytes = abi.encode(
            orderLender[loanOrderHash],
            orderFilledAmounts[loanOrderHash],
            orderCancelledAmounts[loanOrderHash],
            orderTraders[loanOrderHash].length,
            loanPositions[loanOrderHash][orderTraders[loanOrderHash][0]].loanStartUnixTimestampSec
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
            if (forLender && loanParty != orderLender[orderList[loanParty][j-1]]) {
                continue;
            }

            address[] memory traders = orderTraders[orderList[loanParty][j-1]];
            for (uint i=traders.length; i > 0; i--) {
                LoanPosition memory loanPosition = loanPositions[orderList[loanParty][j-1]][traders[i-1]];

                if (activeOnly && !loanPosition.active) {
                    continue;
                }

                if (!forLender && loanParty != loanPosition.trader) {
                    continue;
                }

                bytes memory tmpBytes = abi.encode(
                    loanPosition.lender,
                    loanPosition.trader,
                    loanPosition.collateralTokenAddressFilled,
                    loanPosition.positionTokenAddressFilled,
                    loanPosition.loanTokenAmountFilled,
                    loanPosition.collateralTokenAmountFilled,
                    loanPosition.positionTokenAmountFilled,
                    loanPosition.loanStartUnixTimestampSec,
                    loanPosition.index,
                    loanPosition.active
                );
                tmpBytes = _addExtraLoanData(
                    orderList[loanParty][j-1],
                    loanPosition,
                    tmpBytes,
                    activeOnly);
                if (tmpBytes.length == 0) {
                    continue;
                }

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
        bytes data,
        bool activeOnly)
        internal
        view
        returns (bytes)
    {
        LoanOrder memory loanOrder = orders[loanOrderHash];
        if (activeOnly && block.timestamp >= loanOrder.expirationUnixTimestampSec) {
            return;
        }

        InterestData memory interestData = _getInterest(loanOrder, loanPosition);

        bytes memory tmpBytes = abi.encode(
            loanOrderHash,
            loanOrder.loanTokenAddress,
            interestData.interestTokenAddress,
            interestData.interestTotalAccrued,
            interestData.interestPaidSoFar
        );
        return abi.encodePacked(data, tmpBytes);
    }

    /// @dev Verifies that an order signature is valid.
    /// @param signer address of signer.
    /// @param hash Signed Keccak-256 hash.
    /// @param signature ECDSA signature in raw bytes (rsv) + signatureType.
    /// @return Validity of order signature.
    function _isValidSignature(
        address signer,
        bytes32 hash,
        bytes signature)
        internal
        pure
        returns (bool)
    {
        SignatureType signatureType;
        uint8 v;
        bytes32 r;
        bytes32 s;
        (signatureType, v, r, s) = _getSignatureParts(signature);

        // Signature using EIP712
        if (signatureType == SignatureType.EIP712) {
            return signer == ecrecover(
                hash,
                v,
                r,
                s
            );            

        // Signed using web3.eth_sign
        } else if (signatureType == SignatureType.EthSign) {
            return signer == ecrecover(
                keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)),
                v,
                r,
                s
            );

        // Signature from Trezor hardware wallet.
        // It differs from web3.eth_sign in the encoding of message length
        // (Bitcoin varint encoding vs ascii-decimal, the latter is not
        // self-terminating which leads to ambiguities).
        // See also:
        // https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_integer
        // https://github.com/trezor/trezor-mcu/blob/master/firmware/ethereum.c#L602
        // https://github.com/trezor/trezor-mcu/blob/master/firmware/crypto.c#L36
        } else if (signatureType == SignatureType.Trezor) {
            return signer == ecrecover(
                keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n\x20", hash)),
                v,
                r,
                s
            );
        }

        // Anything else is illegal (We do not return false because
        // the signature may actually be valid, just not in a format
        // that we currently support. In this case returning false
        // may lead the caller to incorrectly believe that the
        // signature was invalid.)
        revert("UNSUPPORTED_SIGNATURE_TYPE");
    }

    /// @param signature ECDSA signature in raw bytes (rsv).
    /// @dev This supports 0x V2 SignatureType
    function _getSignatureParts(
        bytes signature)
        internal
        pure
        returns (
            SignatureType signatureType,
            uint8 v,
            bytes32 r,
            bytes32 s)
    {
        require(
            signature.length == 66,
            "INVALID_SIGNATURE_LENGTH"
        );

        uint8 t;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := mload(add(signature, 65))
            t := mload(add(signature, 66))
        }
        signatureType = SignatureType(t);
        if (v < 27) {
            v = v + 27;
        }
    }
}

