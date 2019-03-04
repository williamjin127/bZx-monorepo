/**
 * Copyright 2017-2019, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.3;

import "../openzeppelin-solidity/Ownable.sol";


contract TokenRegistry is Ownable {

    event LogAddToken(
        address indexed token,
        string name,
        string symbol,
        uint8 decimals,
        string url
    );

    event LogRemoveToken(
        address indexed token,
        string name,
        string symbol,
        uint8 decimals,
        string url
    );

    event LogTokenNameChange(address indexed token, string oldName, string newName);
    event LogTokenSymbolChange(address indexed token, string oldSymbol, string newSymbol);
    event LogTokenURLChange(address indexed token, string oldURL, string newURL);

    mapping (address => TokenMetadata) public tokens;
    mapping (string => address) internal tokenBySymbol;
    mapping (string => address) internal tokenByName;

    address[] public tokenAddresses;

    struct TokenMetadata {
        address token;
        string name;
        string symbol;
        uint8 decimals;
        string url;
    }

    modifier tokenExists(address _token) {
        require(tokens[_token].token != address(0), "TokenRegistry::token doesn't exist");
        _;
    }

    modifier tokenDoesNotExist(address _token) {
        require(tokens[_token].token == address(0), "TokenRegistry::token exists");
        _;
    }

    modifier nameDoesNotExist(string memory _name) {
        require(tokenByName[_name] == address(0), "TokenRegistry::name exists");
        _;
    }

    modifier symbolDoesNotExist(string memory _symbol) {
        require(tokenBySymbol[_symbol] == address(0), "TokenRegistry::symbol exists");
        _;
    }

    modifier addressNotNull(address _address) {
        require(_address != address(0), "TokenRegistry::address is null");
        _;
    }

    /// @dev Allows owner to add a new token to the registry.
    /// @param _token Address of new token.
    /// @param _name Name of new token.
    /// @param _symbol Symbol for new token.
    /// @param _decimals Number of decimals, divisibility of new token.
    /// @param _url URL of token icon.
    function addToken(
        address _token,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        string memory _url)
        public
        onlyOwner
        tokenDoesNotExist(_token)
        addressNotNull(_token)
        symbolDoesNotExist(_symbol)
        nameDoesNotExist(_name)
    {
        tokens[_token] = TokenMetadata({
            token: _token,
            name: _name,
            symbol: _symbol,
            decimals: _decimals,
            url: _url
        });
        tokenAddresses.push(_token);
        tokenBySymbol[_symbol] = _token;
        tokenByName[_name] = _token;
        emit LogAddToken(
            _token,
            _name,
            _symbol,
            _decimals,
            _url
        );
    }

    /// @dev Allows owner to remove an existing token from the registry.
    /// @param _token Address of existing token.
    function removeToken(address _token, uint256 _index)
        public
        onlyOwner
        tokenExists(_token)
    {
        require(tokenAddresses[_index] == _token, "TokenRegistry::invalid index");

        tokenAddresses[_index] = tokenAddresses[tokenAddresses.length - 1];
        tokenAddresses.length -= 1;

        TokenMetadata storage token = tokens[_token];
        emit LogRemoveToken(
            token.token,
            token.name,
            token.symbol,
            token.decimals,
            token.url
        );
        delete tokenBySymbol[token.symbol];
        delete tokenByName[token.name];
        delete tokens[_token];
    }

    /// @dev Allows owner to modify an existing token's name.
    /// @param _token Address of existing token.
    /// @param _name New name.
    function setTokenName(address _token, string memory _name)
        public
        onlyOwner
        tokenExists(_token)
        nameDoesNotExist(_name)
    {
        TokenMetadata storage token = tokens[_token];
        emit LogTokenNameChange(_token, token.name, _name);
        delete tokenByName[token.name];
        tokenByName[_name] = _token;
        token.name = _name;
    }

    /// @dev Allows owner to modify an existing token's symbol.
    /// @param _token Address of existing token.
    /// @param _symbol New symbol.
    function setTokenSymbol(address _token, string memory _symbol)
        public
        onlyOwner
        tokenExists(_token)
        symbolDoesNotExist(_symbol)
    {
        TokenMetadata storage token = tokens[_token];
        emit LogTokenSymbolChange(_token, token.symbol, _symbol);
        delete tokenBySymbol[token.symbol];
        tokenBySymbol[_symbol] = _token;
        token.symbol = _symbol;
    }

    /// @dev Allows owner to modify an existing token's icon URL.
    /// @param _token URL of token token.
    /// @param _url New URL to token icon.
    function setTokenURL(address _token, string memory _url)
        public
        onlyOwner
        tokenExists(_token)
    {
        TokenMetadata storage token = tokens[_token];
        emit LogTokenURLChange(_token, token.url, _url);
        token.url = _url;
    }

    /*
     * View functions
     */
    /// @dev Provides a registered token's address when given the token symbol.
    /// @param _symbol Symbol of registered token.
    /// @return Token's address.
    function getTokenAddressBySymbol(string memory _symbol) 
        public
        view 
        returns (address)
    {
        return tokenBySymbol[_symbol];
    }

    /// @dev Provides a registered token's address when given the token name.
    /// @param _name Name of registered token.
    /// @return Token's address.
    function getTokenAddressByName(string memory _name) 
        public
        view
        returns (address)
    {
        return tokenByName[_name];
    }

    /// @dev Provides a registered token's metadata, looked up by address.
    /// @param _token Address of registered token.
    /// @return Token metadata.
    function getTokenMetaData(address _token)
        public
        view
        returns (
            address,  //tokenAddress
            string memory,   //name
            string memory,   //symbol
            uint8,    //decimals
            string memory    //url
        )
    {
        TokenMetadata memory token = tokens[_token];
        return (
            token.token,
            token.name,
            token.symbol,
            token.decimals,
            token.url
        );
    }

    /// @dev Provides a registered token's metadata, looked up by name.
    /// @param _name Name of registered token.
    /// @return Token metadata.
    function getTokenByName(string memory _name)
        public
        view
        returns (
            address,  //tokenAddress
            string memory,   //name
            string memory,   //symbol
            uint8,    //decimals
            string memory    //url
        )
    {
        address _token = tokenByName[_name];
        return getTokenMetaData(_token);
    }

    /// @dev Provides a registered token's metadata, looked up by symbol.
    /// @param _symbol Symbol of registered token.
    /// @return Token metadata.
    function getTokenBySymbol(string memory _symbol)
        public
        view
        returns (
            address,  //tokenAddress
            string memory,   //name
            string memory,   //symbol
            uint8,    //decimals
            string memory    //url
        )
    {
        address _token = tokenBySymbol[_symbol];
        return getTokenMetaData(_token);
    }

    /// @dev Returns an array containing all token addresses.
    /// @return Array of token addresses.
    function getTokenAddresses()
        public
        view
        returns (address[] memory)
    {
        return tokenAddresses;
    }
}
