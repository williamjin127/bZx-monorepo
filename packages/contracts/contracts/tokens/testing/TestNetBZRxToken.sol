/**
 * Copyright 2017–2018, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.2;

import "../../openzeppelin-solidity/Ownable.sol";
import "../BaseToken.sol";


contract TestNetBZRxToken is Ownable, BaseToken( // solhint-disable-line no-empty-blocks
    10**(50+18),
    "BZRX Protocol Token", 
    18,
    "BZRX"
) {
    function renameToken(
        string  memory _newName,
        string  memory _newSymbol
        )
        public
        onlyOwner
    {
        name = _newName;
        symbol = _newSymbol;
    }
}