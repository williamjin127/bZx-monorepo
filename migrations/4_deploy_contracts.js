
var B0xToken = artifacts.require("./B0xToken.sol");

// owned by msg.sender (Ownable)
var B0x = artifacts.require("./B0x.sol");

// owned by B0x (B0xOwnable)
var B0xVault = artifacts.require("./B0xVault.sol");
var B0xTo0x = artifacts.require("./B0xTo0x.sol");
var B0xOracle = artifacts.require("./B0xOracle.sol");
var OracleRegistry = artifacts.require("./OracleRegistry.sol");

// the actual 0xProject Exchange contract that has been redeployed to the test network
// remove this prior to public deployment
var Exchange0x = artifacts.require("./Exchange.sol");

/*let testWallets = [
    "0x5409ED021D9299bf6814279A6A1411A7e866A631",
	"0x6Ecbe1DB9EF729CBe972C83Fb886247691Fb6beb",
	"0xE36Ea790bc9d7AB70C55260C66D52b1eca985f84",
	"0xE834EC434DABA538cd1b9Fe1582052B880BD7e63",
	"0x78dc5D2D739606d31509C31d654056A45185ECb6",
	"0xA8dDa8d7F5310E4A9E24F8eBA77E091Ac264f872",
	"0x06cEf8E666768cC40Cc78CF93d9611019dDcB628",
	"0x4404ac8bd8F9618D27Ad2f1485AA1B2cFD82482D",
	"0x7457d5E02197480Db681D3fdF256c7acA21bDc12",
	"0x91c987bf62D25945dB517BDAa840A6c661374402"
];*/
// Mnemonic: concert load couple harbor equip island argue ramp clarify fence smart topic

let contracts0x = {
	"ZRXToken": "0x25B8Fe1DE9dAf8BA351890744FF28cf7dFa8f5e3",
	"EtherToken": "0x48BaCB9266a570d521063EF5dD96e61686DbE788",
	"Exchange": "0xB69e673309512a9D726F87304C6984054f87a93b",
	"TokenRegistry": "0x0B1ba0af832d7C05fD64161E0Db78E85978E8082",
	"TokenTransferProxy": "0x871DD7C2B4b25E1Aa18728e9D5f2Af4C4e431f5c"
};

let KyberContractAddress = "0x0000000000000000000000000000000000000000";

module.exports = function(deployer, network, accounts) {

	//console.log("before balance: "+web3.eth.getBalance(accounts[0]));

	return deployer.deploy(B0xVault).then(function() {
		return deployer.deploy(B0xTo0x, B0xVault.address, Exchange0x.address, contracts0x["ZRXToken"]).then(function() {
			return deployer.deploy(B0x, B0xToken.address, B0xVault.address, B0xTo0x.address).then(function() {

				B0xVault.deployed().then(function(instance) {
					instance.transferB0xOwnership(B0x.address);
				});

				B0xTo0x.deployed().then(function(instance) {
					instance.transferB0xOwnership(B0x.address);
				});

				return deployer.deploy(OracleRegistry).then(function() {
					return deployer.deploy(B0xOracle, B0xVault.address, KyberContractAddress
						,{from: accounts[0], value: web3.toWei(1, "ether")}).then(function() { // seeds B0xOracle with 1 Ether
						
							OracleRegistry.deployed().then(function(instance) {
								instance.addOracle(B0xOracle.address,"b0xOracle");
								
								return;
							});

							B0xOracle.deployed().then(function(instance) {
								instance.transferB0xOwnership(B0x.address);
								
								console.log("migrations :: after balance: "+web3.eth.getBalance(accounts[0]));
								
								console.log("B0xVault: "+B0xVault.address);
								console.log("Exchange(0xProject): "+Exchange0x.address);
								console.log("B0xTo0x: "+B0xTo0x.address);
								console.log("B0x: "+B0x.address);
								console.log("B0xOracle: "+B0xOracle.address);

								return;
							});
					});
				});
			});
		});
	});
}
