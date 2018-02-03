/*

  Copyright 2018 b0x, LLC
  Inspired by TokenRegistry.sol, Copyright 2017 ZeroEx Intl.

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

pragma solidity ^0.4.19;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

/// @title Oracle Registry - Oracles added to the b0x network by decentralized governance
contract OracleRegistry is Ownable {

    event LogAddOracle(
        address indexed oracle,
        string name
    );

    event LogRemoveOracle(
        address indexed oracle,
        string name
    );

    event LogOracleNameChange(address indexed oracle, string oldName, string newName);

    mapping (address => OracleMetadata) public oracles;
    mapping (string => address) oracleByName;

    address[] public oracleAddresses;

    struct OracleMetadata {
        address oracle;
        string name;
    }

    modifier oracleExists(address _oracle) {
        require(oracles[_oracle].oracle != address(0));
        _;
    }

    modifier oracleDoesNotExist(address _oracle) {
        require(oracles[_oracle].oracle == address(0));
        _;
    }

    modifier nameDoesNotExist(string _name) {
        require(oracleByName[_name] == address(0));
        _;
    }

    modifier addressNotNull(address _address) {
        require(_address != address(0));
        _;
    }


    /// @dev Allows owner to add a new oracle to the registry.
    /// @param _oracle Address of new oracle.
    /// @param _name Name of new oracle.
    function addOracle(
        address _oracle,
        string _name)
        public
        onlyOwner
        oracleDoesNotExist(_oracle)
        addressNotNull(_oracle)
        nameDoesNotExist(_name)
    {
        oracles[_oracle] = OracleMetadata({
            oracle: _oracle,
            name: _name
        });
        oracleAddresses.push(_oracle);
        oracleByName[_name] = _oracle;
        LogAddOracle(
            _oracle,
            _name
        );
    }

    /// @dev Allows owner to remove an existing oracle from the registry.
    /// @param _oracle Address of existing oracle.
    function removeOracle(address _oracle, uint _index)
        public
        onlyOwner
        oracleExists(_oracle)
    {
        require(oracleAddresses[_index] == _oracle);

        oracleAddresses[_index] = oracleAddresses[oracleAddresses.length - 1];
        oracleAddresses.length -= 1;

        OracleMetadata storage oracle = oracles[_oracle];
        LogRemoveOracle(
            oracle.oracle,
            oracle.name
        );
        delete oracleByName[oracle.name];
        delete oracles[_oracle];
    }

    /// @dev Allows owner to modify an existing oracle's name.
    /// @param _oracle Address of existing oracle.
    /// @param _name New name.
    function setOracleName(address _oracle, string _name)
        public
        onlyOwner
        oracleExists(_oracle)
        nameDoesNotExist(_name)
    {
        OracleMetadata storage oracle = oracles[_oracle];
        LogOracleNameChange(_oracle, oracle.name, _name);
        delete oracleByName[oracle.name];
        oracleByName[_name] = _oracle;
        oracle.name = _name;
    }

    /*
     * Web3 call functions
     */

    /// @dev Provides a registered oracle's address when given the oracle name.
    /// @param _name Name of registered oracle.
    /// @return Oracle's address.
    function getOracleAddressByName(string _name) public constant returns (address) {
        return oracleByName[_name];
    }

    /// @dev Provides a registered oracle's metadata, looked up by address.
    /// @param _oracle Address of registered oracle.
    /// @return Oracle metadata.
    function getOracleMetaData(address _oracle)
        public
        constant
        returns (
            address,  //oracleAddress
            string   //name
        )
    {
        OracleMetadata memory oracle = oracles[_oracle];
        return (
            oracle.oracle,
            oracle.name
        );
    }

    /// @dev Provides a registered oracle's metadata, looked up by name.
    /// @param _name Name of registered oracle.
    /// @return Oracle metadata.
    function getOracleByName(string _name)
        public
        constant
        returns (
            address,  //oracleAddress
            string   //name
        )
    {
        address _oracle = oracleByName[_name];
        return getOracleMetaData(_oracle);
    }

    /// @dev Returns an array containing all oracle addresses.
    /// @return Array of oracle addresses.
    function getOracleAddresses()
        public
        constant
        returns (address[])
    {
        return oracleAddresses;
    }
}
