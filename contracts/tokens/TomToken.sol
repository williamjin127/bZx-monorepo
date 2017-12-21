pragma solidity ^0.4.4;

//import '../tokens/HumanStandardToken.sol';
import '../simulations/ERC20_AlwaysOwned.sol';

// 20 million tokens (18 decimal places), 20 * 10**24
contract TOMToken is ERC20_AlwaysOwned(
	10000000000000000000000000,
	"Tom Token", 
	18, 
	"TOM"
) {}