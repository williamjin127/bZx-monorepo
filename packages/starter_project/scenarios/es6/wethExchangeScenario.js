const artifacts = require("./../../artifacts");
const utils = require("./../../utils");

async function wethExchangeScenario(l, c, walletAddress) {
  // wrapping eth to weth for trading as tokens
  const wrapReceipt = await c.bzxjs.wrapEth({
    amount: c.web3.utils.toWei("2", "ether"),
    getObject: false,
    txOpts: { from: walletAddress, gasLimit: utils.gasLimit }
  });
  console.dir(wrapReceipt);

  // partially unwrapping weth to eth
  const unwrapReceipt = await c.bzxjs.unwrapEth({
    amount: c.web3.utils.toWei("1", "ether"),
    getObject: false,
    txOpts: { from: walletAddress, gasLimit: utils.gasLimit }
  });
  console.dir(unwrapReceipt);

  // getting balance of weth
  let balance = await c.bzxjs.getBalance({
    tokenAddress: artifacts.weth.address.toLowerCase(),
    ownerAddress: walletAddress.toLowerCase()
  });
  console.dir(balance.toString());
}

module.exports.wethExchangeScenario = wethExchangeScenario;
