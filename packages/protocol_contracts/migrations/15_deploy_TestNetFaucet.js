
const DEPOSIT_BZRX = true;

var TestNetFaucet = artifacts.require("TestNetFaucet");
var TestNetOracle = artifacts.require("TestNetOracle");

var BZRxToken = artifacts.require("BZRxToken");
var TestNetBZRxToken = artifacts.require("TestNetBZRxToken");

var config = require('../protocol-config.js');

module.exports = function(deployer, network, accounts) {
	network = network.replace("-fork", "");
	if (network == "mainnet")
		return;

	if (network == "develop" || network == "development" || network == "testnet")
		network = "development";
	else {
		// comment out if we need to deploy to other networks
		return;
	}

	deployer.deploy(TestNetFaucet).then(async function(testNetFaucet) {

		if (network != "ropsten" && network != "mainnet") {
			var oracle = await TestNetOracle.deployed();
			await oracle.setFaucetContractAddress(testNetFaucet.address);
			await testNetFaucet.setOracleContractAddress(oracle.address);
		}

		if (DEPOSIT_BZRX) {
			var bzrx_token;
			if (network == "ropsten" || network == "kovan" || network == "rinkeby") {
				bzrx_token = await BZRxToken.at(config["addresses"][network]["BZRXToken"]);
			} else {
				bzrx_token = await TestNetBZRxToken.deployed();
			}

			await bzrx_token.transfer(testNetFaucet.address, web3.toWei(100000000000000000, "ether"));
		}
	});
}
