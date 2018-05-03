
pragma solidity ^0.4.23;

import '../BaseToken.sol';

// 1 billion tokens (18 decimal places)
contract TestToken2 is BaseToken(
	10**(50+18),
	"TestToken2", 
	18,
	"TEST2"
) {}
