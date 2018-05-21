
pragma solidity ^0.4.24;

import '../BaseToken.sol';

// 1 billion tokens (18 decimal places)
contract TestToken6 is BaseToken(
	10**(50+18),
	"TestToken6", 
	18,
	"TEST6"
) {}
