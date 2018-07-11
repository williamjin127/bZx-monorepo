
var BZxVault = artifacts.require("BZxVault");

module.exports = function(deployer, network, accounts) {
	web3.eth.getBalance(accounts[0], function(error, balance) {
		console.log("migrations :: initial balance: "+balance);
	});
	
	deployer.deploy(BZxVault);
}
