
pragma solidity 0.4.18;

//import 'zeppelin-solidity/contracts/token/ERC20.sol';

/**
 * @title EIP20/ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
/*contract EIP20 is ERC20 {
    string public name;
    uint8 public decimals;
    string public symbol;
}*/

// Testing only! Please remove below and use above for non-dev environments!
import './fake/ERC20_AlwaysOwned.sol';
contract EIP20 is ERC20_AlwaysOwned {}

