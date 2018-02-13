
pragma solidity ^0.4.19;

//import './UnlimitedAllowanceToken.sol';
import './fake/ERC827_AlwaysOwned.sol'; // Testing only! Please remove below and use above for production!

contract BaseToken is ERC827_AlwaysOwned {
    string public name;
    uint8 public decimals;
    string public symbol;

    function BaseToken(
        uint256 _initialAmount,
        string _tokenName,
        uint8 _decimalUnits,
        string _tokenSymbol
        ) public {
        balances[msg.sender] = _initialAmount;               // Give the creator all initial tokens
        totalSupply_ = _initialAmount;                        // Update total supply
        name = _tokenName;                                   // Set the name for display purposes
        decimals = _decimalUnits;                            // Amount of decimals for display purposes
        symbol = _tokenSymbol;                               // Set the symbol for display purposes
    }
}
