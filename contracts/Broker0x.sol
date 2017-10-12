/*

  Copyright 2017 Tom Bean
  Parts copyright 2017 ZeroEx Intl.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

pragma solidity ^0.4.9;
import '../oz_contracts/token/StandardToken.sol';
import '../oz_contracts/math/SafeMath.sol';
import '../oz_contracts/ownership/Ownable.sol';
import '../oz_contracts/ReentrancyGuard.sol';

import './api.sol';
//import './RESTToken.sol';
import './Broker0xVault.sol';
import './TokenTransferProxy.sol';

import './BrokerTokenPrices.sol';

contract Broker0x is Ownable, ReentrancyGuard, usingTinyOracle {
    using SafeMath for uint256;

    // Error Codes
    enum Errors {
        ORDER_EXPIRED,                    // Order has already expired
        ORDER_FULLY_FILLED_OR_CANCELLED,  // Order has already been fully filled or cancelled
        ROUNDING_ERROR_TOO_LARGE,         // Rounding error too large
        INSUFFICIENT_BALANCE_OR_ALLOWANCE // Insufficient balance or allowance for token transfer
    }

    string constant public VERSION = "1.0.0";
    uint16 constant public EXTERNAL_QUERY_GAS_LIMIT = 4999;    // Changes to state require at least 5000 gas

    address public REST_TOKEN_CONTRACT;
    address public TOKEN_TRANSFER_PROXY_CONTRACT;
    address public VAULT_CONTRACT;
    address public TOKEN_PRICES_CONTRACT;

    // Mappings of orderHash => amounts of takerTokenAmount filled or cancelled.
    mapping (bytes32 => uint) public filled;
    mapping (bytes32 => uint) public cancelled;

    //mapping (address => mapping (bytes32 => bool)) public orders; //mapping of user accounts to mapping of order hashes to booleans (true = submitted by user, equivalent to offchain signature)
    //mapping (address => mapping (bytes32 => uint)) public orderFills; //mapping of user accounts to mapping of order hashes to uints (amount of order that has been filled)


    event LogFill(
        address indexed maker,
        address taker,
        address indexed feeRecipient,
        address makerToken,
        address takerToken,
        uint filledMakerTokenAmount,
        uint filledTakerTokenAmount,
        uint paidMakerFee,
        uint paidTakerFee,
        bytes32 indexed tokens, // keccak256(makerToken, takerToken), allows subscribing to a token pair
        bytes32 orderHash
    );

    event LogCancel(
        address indexed maker,
        address indexed feeRecipient,
        address makerToken,
        address takerToken,
        uint cancelledMakerTokenAmount,
        uint cancelledTakerTokenAmount,
        bytes32 indexed tokens,
        bytes32 orderHash
    );

    event LogError(uint8 indexed errorId, bytes32 indexed orderHash);

    event DepositEtherMargin(address user, uint amount, uint balance);
    event DepositEtherFunding(address user, uint amount, uint balance);
    event DepositTokenMargin(address token, address user, uint amount, uint balance);
    event DepositTokenFunding(address token, address user, uint amount, uint balance);
    
    event WithdrawEtherMargin(address user, uint amount, uint balance);
    event WithdrawEtherFunding(address user, uint amount, uint balance);
    event WithdrawTokenMargin(address token, address user, uint amount, uint balance);
    event WithdrawTokenFunding(address token, address user, uint amount, uint balance);

    struct Order {
        address maker;
        address taker;
        address makerToken;
        address takerToken;
        address feeRecipient;
        uint makerTokenAmount;
        uint takerTokenAmount;
        uint makerFee;
        uint takerFee;
        uint expirationTimestampInSec;
        bytes32 orderHash;
    }

    function() {
        revert();
    }

    function Broker0x(address _restToken, address _tokenTransferProxy, address _vault, address _tokenPrices) {
        REST_TOKEN_CONTRACT = _restToken;
        TOKEN_TRANSFER_PROXY_CONTRACT = _tokenTransferProxy;
        VAULT_CONTRACT = _vault;
        TOKEN_PRICES_CONTRACT = _tokenPrices;
    }

    bytes public response;
    function __tinyOracleCallback(uint256 id_, address token_, uint price_) onlyFromTinyOracle external {
        require(BrokerTokenPrices(TOKEN_PRICES_CONTRACT).setTokenPrice(msg.sender, token_, price_));
    }

    // this is purely for testing in a test environment
    // NOT FOR PRODUCTION!
    function testSendPriceUpdate(address token_, uint price_) public {
        require(BrokerTokenPrices(TOKEN_PRICES_CONTRACT).setTokenPrice(msg.sender, token_, price_));
    }

    // uint price = BrokerTokenPrices(TOKEN_PRICES_CONTRACT).getTokenPrice(token_)


    function depositEtherMargin() external nonReentrant payable {
        uint balance = Broker0xVault(VAULT_CONTRACT).depositEtherMargin.value(msg.value)(msg.sender);
        DepositEtherMargin(msg.sender, msg.value, balance);
    }
    function depositEtherFunding() external nonReentrant payable {
        uint balance = Broker0xVault(VAULT_CONTRACT).depositEtherFunding.value(msg.value)(msg.sender);
        DepositEtherFunding(msg.sender, msg.value, balance);
    }
    function depositTokenMargin(address token_, uint amount_) external nonReentrant {
        //remember to call ERC20(address).approve(this, amount) or this contract will not be able to do the transfer on your behalf.
        require(token_ != 0);
        require(ERC20(token_).transferFrom(msg.sender, VAULT_CONTRACT, amount_));
        
        uint balance = Broker0xVault(VAULT_CONTRACT).depositTokenMargin(token_, msg.sender, amount_);
        DepositTokenMargin(token_, msg.sender, amount_, balance);
    }
    function depositTokenFunding(address token_, uint amount_) external nonReentrant {
        //remember to call ERC20(address).approve(this, amount) or this contract will not be able to do the transfer on your behalf.
        require(token_ != 0);
        require(ERC20(token_).transferFrom(msg.sender, VAULT_CONTRACT, amount_));
        
        uint balance = Broker0xVault(VAULT_CONTRACT).depositTokenFunding(token_, msg.sender, amount_);
        DepositTokenFunding(token_, msg.sender, amount_, balance);
    }


    function withdrawEtherMargin(uint amount_) external nonReentrant {
        uint balance = Broker0xVault(VAULT_CONTRACT).withdrawEtherMargin(msg.sender, amount_);
        WithdrawEtherMargin(msg.sender, amount_, balance);
    }
    function withdrawEtherFunding(uint amount_) external nonReentrant {
        uint balance = Broker0xVault(VAULT_CONTRACT).withdrawEtherFunding(msg.sender, amount_);
        WithdrawEtherFunding(msg.sender, amount_, balance);
    }
    function withdrawTokenMargin(address token_, uint amount_) external nonReentrant {
        require(token_ != 0);        
        uint balance = Broker0xVault(VAULT_CONTRACT).withdrawTokenMargin(token_, msg.sender, amount_);
        WithdrawTokenMargin(token_, msg.sender, amount_, balance);
    }
    function withdrawTokenFunding(address token_, uint amount_) external nonReentrant {
        require(token_ != 0);        
        uint balance = Broker0xVault(VAULT_CONTRACT).withdrawTokenFunding(token_, msg.sender, amount_);
        WithdrawTokenFunding(token_, msg.sender, amount_, balance);
    }


    function _checkAvailableMargin(address user_) private returns (uint) {
        uint available = Broker0xVault(VAULT_CONTRACT).marginBalanceOf(0,user_);
        return available; 
    }

    function _checkAvailableFunding(address user_) private returns (uint) {
        uint available = Broker0xVault(VAULT_CONTRACT).fundingBalanceOf(0,user_);
        return available; 
    }

    /*
    * Core exchange functions
    */

    /// @dev Fills the input order.
    /// @param orderAddresses Array of order's maker, taker, makerToken, takerToken, and feeRecipient.
    /// @param orderValues Array of order's makerTokenAmount, takerTokenAmount, makerFee, takerFee, expirationTimestampInSec, and salt.
    /// @param fillTakerTokenAmount Desired amount of takerToken to fill.
    /// @param shouldThrowOnInsufficientBalanceOrAllowance Test if transfer will fail before attempting.
    /// @param v ECDSA signature parameter v.
    /// @param r ECDSA signature parameters r.
    /// @param s ECDSA signature parameters s.
    /// @return Total amount of takerToken filled in trade.
    function fillOrder(
          address[5] orderAddresses,
          uint[6] orderValues,
          uint fillTakerTokenAmount,
          bool shouldThrowOnInsufficientBalanceOrAllowance,
          uint8 v,
          bytes32 r,
          bytes32 s)
          public
          returns (uint filledTakerTokenAmount)
    {
        Order memory order = Order({
            maker: orderAddresses[0],
            taker: orderAddresses[1],
            makerToken: orderAddresses[2],
            takerToken: orderAddresses[3],
            feeRecipient: orderAddresses[4],
            makerTokenAmount: orderValues[0],
            takerTokenAmount: orderValues[1],
            makerFee: orderValues[2],
            takerFee: orderValues[3],
            expirationTimestampInSec: orderValues[4],
            orderHash: getOrderHash(orderAddresses, orderValues)
        });

        require(order.taker == address(0) || order.taker == msg.sender);
        require(order.makerTokenAmount > 0 && order.takerTokenAmount > 0 && fillTakerTokenAmount > 0);
        require(isValidSignature(
            order.maker,
            order.orderHash,
            v,
            r,
            s
        ));

        if (block.timestamp >= order.expirationTimestampInSec) {
            LogError(uint8(Errors.ORDER_EXPIRED), order.orderHash);
            return 0;
        }

        uint remainingTakerTokenAmount = order.takerTokenAmount.sub(getUnavailableTakerTokenAmount(order.orderHash));
        filledTakerTokenAmount = SafeMath.min256(fillTakerTokenAmount, remainingTakerTokenAmount);
        if (filledTakerTokenAmount == 0) {
            LogError(uint8(Errors.ORDER_FULLY_FILLED_OR_CANCELLED), order.orderHash);
            return 0;
        }

        if (isRoundingError(filledTakerTokenAmount, order.takerTokenAmount, order.makerTokenAmount)) {
            LogError(uint8(Errors.ROUNDING_ERROR_TOO_LARGE), order.orderHash);
            return 0;
        }

        if (!shouldThrowOnInsufficientBalanceOrAllowance && !isTransferable(order, filledTakerTokenAmount)) {
            LogError(uint8(Errors.INSUFFICIENT_BALANCE_OR_ALLOWANCE), order.orderHash);
            return 0;
        }

        uint filledMakerTokenAmount = getPartialAmount(filledTakerTokenAmount, order.takerTokenAmount, order.makerTokenAmount);
        uint paidMakerFee;
        uint paidTakerFee;
        filled[order.orderHash] = filled[order.orderHash].add(filledTakerTokenAmount);
        require(transferViaTokenTransferProxy(
            order.makerToken,
            order.maker,
            msg.sender,
            filledMakerTokenAmount
        ));
        require(transferViaTokenTransferProxy(
            order.takerToken,
            msg.sender,
            order.maker,
            filledTakerTokenAmount
        ));
        if (order.feeRecipient != address(0)) {
            if (order.makerFee > 0) {
                paidMakerFee = getPartialAmount(filledTakerTokenAmount, order.takerTokenAmount, order.makerFee);
                require(transferViaTokenTransferProxy(
                    REST_TOKEN_CONTRACT,
                    order.maker,
                    order.feeRecipient,
                    paidMakerFee
                ));
            }
            if (order.takerFee > 0) {
                paidTakerFee = getPartialAmount(filledTakerTokenAmount, order.takerTokenAmount, order.takerFee);
                require(transferViaTokenTransferProxy(
                    REST_TOKEN_CONTRACT,
                    msg.sender,
                    order.feeRecipient,
                    paidTakerFee
                ));
            }
        }

        LogFill(
            order.maker,
            msg.sender,
            order.feeRecipient,
            order.makerToken,
            order.takerToken,
            filledMakerTokenAmount,
            filledTakerTokenAmount,
            paidMakerFee,
            paidTakerFee,
            keccak256(order.makerToken, order.takerToken),
            order.orderHash
        );
        return filledTakerTokenAmount;
    }

   /// @dev Cancels the input order.
    /// @param orderAddresses Array of order's maker, taker, makerToken, takerToken, and feeRecipient.
    /// @param orderValues Array of order's makerTokenAmount, takerTokenAmount, makerFee, takerFee, expirationTimestampInSec, and salt.
    /// @param cancelTakerTokenAmount Desired amount of takerToken to cancel in order.
    /// @return Amount of takerToken cancelled.
    function cancelOrder(
        address[5] orderAddresses,
        uint[6] orderValues,
        uint cancelTakerTokenAmount)
        public
        returns (uint)
    {
        Order memory order = Order({
            maker: orderAddresses[0],
            taker: orderAddresses[1],
            makerToken: orderAddresses[2],
            takerToken: orderAddresses[3],
            feeRecipient: orderAddresses[4],
            makerTokenAmount: orderValues[0],
            takerTokenAmount: orderValues[1],
            makerFee: orderValues[2],
            takerFee: orderValues[3],
            expirationTimestampInSec: orderValues[4],
            orderHash: getOrderHash(orderAddresses, orderValues)
        });

        require(order.maker == msg.sender);
        require(order.makerTokenAmount > 0 && order.takerTokenAmount > 0 && cancelTakerTokenAmount > 0);

        if (block.timestamp >= order.expirationTimestampInSec) {
            LogError(uint8(Errors.ORDER_EXPIRED), order.orderHash);
            return 0;
        }

        uint remainingTakerTokenAmount = order.takerTokenAmount.sub(getUnavailableTakerTokenAmount(order.orderHash));
        uint cancelledTakerTokenAmount = SafeMath.min256(cancelTakerTokenAmount, remainingTakerTokenAmount);
        if (cancelledTakerTokenAmount == 0) {
            LogError(uint8(Errors.ORDER_FULLY_FILLED_OR_CANCELLED), order.orderHash);
            return 0;
        }

        cancelled[order.orderHash] = cancelled[order.orderHash].add(cancelledTakerTokenAmount);

        LogCancel(
            order.maker,
            order.feeRecipient,
            order.makerToken,
            order.takerToken,
            getPartialAmount(cancelledTakerTokenAmount, order.takerTokenAmount, order.makerTokenAmount),
            cancelledTakerTokenAmount,
            keccak256(order.makerToken, order.takerToken),
            order.orderHash
        );
        return cancelledTakerTokenAmount;
    }

    /*
    * Constant public functions
    */

    /// @dev Calculates Keccak-256 hash of order with specified parameters.
    /// @param orderAddresses Array of order's maker, taker, makerToken, takerToken, and feeRecipient.
    /// @param orderValues Array of order's makerTokenAmount, takerTokenAmount, makerFee, takerFee, expirationTimestampInSec, and salt.
    /// @return Keccak-256 hash of order.
    function getOrderHash(address[5] orderAddresses, uint[6] orderValues)
        public
        constant
        returns (bytes32)
    {
        return keccak256(
            address(this),
            orderAddresses[0], // maker
            orderAddresses[1], // taker
            orderAddresses[2], // makerToken
            orderAddresses[3], // takerToken
            orderAddresses[4], // feeRecipient
            orderValues[0],    // makerTokenAmount
            orderValues[1],    // takerTokenAmount
            orderValues[2],    // makerFee
            orderValues[3],    // takerFee
            orderValues[4],    // expirationTimestampInSec
            orderValues[5]     // salt
        );
    }

    /// @dev Verifies that an order signature is valid.
    /// @param signer address of signer.
    /// @param hash Signed Keccak-256 hash.
    /// @param v ECDSA signature parameter v.
    /// @param r ECDSA signature parameters r.
    /// @param s ECDSA signature parameters s.
    /// @return Validity of order signature.
    function isValidSignature(
        address signer,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s)
        public
        constant
        returns (bool)
    {
        return signer == ecrecover(
            keccak256("\x19Ethereum Signed Message:\n32", hash),
            v,
            r,
            s
        );
    }

    /// @dev Checks if rounding error > 0.1%.
    /// @param numerator Numerator.
    /// @param denominator Denominator.
    /// @param target Value to multiply with numerator/denominator.
    /// @return Rounding error is present.
    function isRoundingError(uint numerator, uint denominator, uint target)
        public
        constant
        returns (bool)
    {
        uint remainder = mulmod(target, numerator, denominator);
        if (remainder == 0) return false; // No rounding error.

        uint errPercentageTimes1000000 = SafeMath.div(
            remainder.mul(1000000),
            numerator.mul(target)
        );
        return errPercentageTimes1000000 > 1000;
    }

    /// @dev Calculates partial value given a numerator and denominator.
    /// @param numerator Numerator.
    /// @param denominator Denominator.
    /// @param target Value to calculate partial of.
    /// @return Partial value of target.
    function getPartialAmount(uint numerator, uint denominator, uint target)
        public
        constant
        returns (uint)
    {
        return SafeMath.div(SafeMath.mul(numerator, target), denominator);
    }

    /// @dev Calculates the sum of values already filled and cancelled for a given order.
    /// @param orderHash The Keccak-256 hash of the given order.
    /// @return Sum of values already filled and cancelled.
    function getUnavailableTakerTokenAmount(bytes32 orderHash)
        public
        constant
        returns (uint)
    {
        return filled[orderHash].add(cancelled[orderHash]);
    }


    /*
    * Internal functions
    */

    /// @dev Transfers a token using TokenTransferProxy transferFrom function.
    /// @param token Address of token to transferFrom.
    /// @param from Address transfering token.
    /// @param to Address receiving token.
    /// @param value Amount of token to transfer.
    /// @return Success of token transfer.
    function transferViaTokenTransferProxy(
        address token,
        address from,
        address to,
        uint value)
        internal
        returns (bool)
    {
        return TokenTransferProxy(TOKEN_TRANSFER_PROXY_CONTRACT).transferFrom(token, from, to, value);
    }

    /// @dev Checks if any order transfers will fail.
    /// @param order Order struct of params that will be checked.
    /// @param fillTakerTokenAmount Desired amount of takerToken to fill.
    /// @return Predicted result of transfers.
    function isTransferable(Order order, uint fillTakerTokenAmount)
        internal
        constant  // The called token contracts may attempt to change state, but will not be able to due to gas limits on getBalance and getAllowance.
        returns (bool)
    {
        address taker = msg.sender;
        uint fillMakerTokenAmount = getPartialAmount(fillTakerTokenAmount, order.takerTokenAmount, order.makerTokenAmount);

        if (order.feeRecipient != address(0)) {
            bool isMakerTokenZRX = order.makerToken == REST_TOKEN_CONTRACT;
            bool isTakerTokenZRX = order.takerToken == REST_TOKEN_CONTRACT;
            uint paidMakerFee = getPartialAmount(fillTakerTokenAmount, order.takerTokenAmount, order.makerFee);
            uint paidTakerFee = getPartialAmount(fillTakerTokenAmount, order.takerTokenAmount, order.takerFee);
            uint requiredMakerZRX = isMakerTokenZRX ? fillMakerTokenAmount.add(paidMakerFee) : paidMakerFee;
            uint requiredTakerZRX = isTakerTokenZRX ? fillTakerTokenAmount.add(paidTakerFee) : paidTakerFee;

            if (   getBalance(REST_TOKEN_CONTRACT, order.maker) < requiredMakerZRX
                || getAllowance(REST_TOKEN_CONTRACT, order.maker) < requiredMakerZRX
                || getBalance(REST_TOKEN_CONTRACT, taker) < requiredTakerZRX
                || getAllowance(REST_TOKEN_CONTRACT, taker) < requiredTakerZRX
            ) return false;

            if (!isMakerTokenZRX && (   getBalance(order.makerToken, order.maker) < fillMakerTokenAmount // Don't double check makerToken if ZRX
                                     || getAllowance(order.makerToken, order.maker) < fillMakerTokenAmount)
            ) return false;
            if (!isTakerTokenZRX && (   getBalance(order.takerToken, taker) < fillTakerTokenAmount // Don't double check takerToken if ZRX
                                     || getAllowance(order.takerToken, taker) < fillTakerTokenAmount)
            ) return false;
        } else if (   getBalance(order.makerToken, order.maker) < fillMakerTokenAmount
                   || getAllowance(order.makerToken, order.maker) < fillMakerTokenAmount
                   || getBalance(order.takerToken, taker) < fillTakerTokenAmount
                   || getAllowance(order.takerToken, taker) < fillTakerTokenAmount
        ) return false;

        return true;
    }

    /// @dev Get token balance of an address.
    /// @param token Address of token.
    /// @param owner Address of owner.
    /// @return Token balance of owner.
    function getBalance(address token, address owner)
        internal
        constant  // The called token contract may attempt to change state, but will not be able to due to an added gas limit.
        returns (uint)
    {
        return ERC20(token).balanceOf.gas(EXTERNAL_QUERY_GAS_LIMIT)(owner); // Limit gas to prevent reentrancy
    }

    /// @dev Get allowance of token given to TokenTransferProxy by an address.
    /// @param token Address of token.
    /// @param owner Address of owner.
    /// @return Allowance of token given to TokenTransferProxy by owner.
    function getAllowance(address token, address owner)
        internal
        constant  // The called token contract may attempt to change state, but will not be able to due to an added gas limit.
        returns (uint)
    {
        return ERC20(token).allowance.gas(EXTERNAL_QUERY_GAS_LIMIT)(owner, TOKEN_TRANSFER_PROXY_CONTRACT); // Limit gas to prevent reentrancy
    }
}
