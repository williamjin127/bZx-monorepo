const BigNumber = require('bignumber.js');
const BN = require('bn.js');
const ethABI = require('ethereumjs-abi');
const ethUtil = require('ethereumjs-util');
const Web3 = require('web3');


//var provider = TestRPC.provider();
//let web3 = new Web3(provider);
web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545")) // :9545

import Web3Utils from 'web3-utils';

import B0xJS from 'b0x.js'
//import { generatePseudoRandomSalt } from "b0x.js";
//import * as b0xjs from "b0x.js";

import { ZeroEx } from '0x.js';
//const zeroEx = new ZeroEx(new Web3.providers.HttpProvider("http://localhost:8545"));

let B0xVault = artifacts.require("B0xVault");
let B0xTo0x = artifacts.require("B0xTo0x");
let B0xOracle = artifacts.require("B0xOracle");
let B0xSol = artifacts.require("B0x");
let B0xToken = artifacts.require("B0xToken");
let ERC20 = artifacts.require("ERC20"); // for testing with any ERC20 token

let BaseToken = artifacts.require("BaseToken");

let testDepositAmount = web3.toWei(0.001, "ether");
let expected_B0xTokenTotalSupply = web3.toWei(20000000, "ether"); // 20MM B0X

let Exchange0x = artifacts.require("Exchange_Interface");

let currentGasPrice = 20000000000; // 20 gwei
let currentEthPrice = 1000; // USD

/*
ZRXToken.sol: 0x25B8Fe1DE9dAf8BA351890744FF28cf7dFa8f5e3
EtherToken.sol: 0x48BaCB9266a570d521063EF5dD96e61686DbE788
Exchange.sol: 0xB69e673309512a9D726F87304C6984054f87a93b
TokenRegistry.sol: 0x0B1ba0af832d7C05fD64161E0Db78E85978E8082
TokenTransferProxy.sol: 0x871DD7C2B4b25E1Aa18728e9D5f2Af4C4e431f5c

The entirety of the ZRX balance is in the 0x5409ED021D9299bf6814279A6A1411A7e866A631 user account setup by TestRPC.
*/

/*
let test_wallets = [
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
];
Mnemonic: concert load couple harbor equip island argue ramp clarify fence smart topic
*/

let contracts0x = {
	"ZRXToken": "0x25B8Fe1DE9dAf8BA351890744FF28cf7dFa8f5e3",
	"EtherToken": "0x48BaCB9266a570d521063EF5dD96e61686DbE788",
	"Exchange": "0xb69e673309512a9d726f87304c6984054f87a93b",
	"TokenRegistry": "0x0B1ba0af832d7C05fD64161E0Db78E85978E8082",
	"TokenTransferProxy": "0x871DD7C2B4b25E1Aa18728e9D5f2Af4C4e431f5c"
};

let KyberContractAddress = "0x0000000000000000000000000000000000000000";

let account_privatekeys = [
  "f2f48ee19680706196e2e339e5da3491186e0c4c5030670656b0e0164837257d",
  "5d862464fe9303452126c8bc94274b8c5f9874cbd219789b3eb2128075a76f72",
  "df02719c4df8b9b8ac7f551fcb5d9ef48fa27eef7a66453879f4d8fdc6e78fb1",
  "ff12e391b79415e941a94de3bf3a9aee577aed0731e297d5cfa0b8a1e02fa1d0",
  "752dd9cf65e68cfaba7d60225cbdbc1f4729dd5e5507def72815ed0d8abc6249",
  "efb595a0178eb79a8df953f87c5148402a224cdf725e88c0146727c6aceadccd",
  "83c6d2cc5ddcf9711a6d59b417dc20eb48afd58d45290099e5987e3d768f328f",
  "bb2d3f7c9583780a7d3904a2f55d792707c345f21de1bacb2d389934d82796b2",
  "b2fd4d29c1390b71b8795ae81196bfd60293adf99f9d32a0aff06288fcdac55f",
  "23cb7121166b9a2f93ae0b7c05bde02eae50d64449b2cbb42bc84e9d38d6cc89"
];


contract('B0xTest', function(accounts) {
  var vault;
  var b0x;
  var oracle;
  var b0x_token;
  var exchange0x_wrapper;
  //var b0xjs;

  var test_tokens = [];

  var gasRefundEvent;
  var logErrorTextEvent;
  var logErrorEvent0x;

  var tx_obj;

  var zrx_token;
  var exchange_0x;
  //var 0x_token_registry;

  var OrderParams_b0x;
  var OrderHash_b0x;
  var ECSignature_raw;
  var ECSignature;


  var OrderParams_0x;
  var OrderHash_0x;
  var ECSignature_0x_raw;
  var ECSignature_0x;

  //printBalances(accounts);

  before(function() {
    new Promise((resolve, reject) => {
      console.log("b0x_tester :: before balance: "+web3.eth.getBalance(accounts[0]));
      const gasPrice = new BigNumber(web3.toWei(2, 'gwei'));
      //b0xjs = new B0xJS(web3.currentProvider, { gasPrice });
      //b0xjs = new B0xJS();
      //resolve(b0xjs);
      resolve(true);
    });
  });

  /*before('deploy all contracts', async function () {
    await Promise.all([
      (b0x_token = await B0xToken.new()),
      (vault = await B0xVault.new()),
    ]);

    await Promise.all([
      (b0x = await B0xSol.new(b0x_token.address,vault.address,kyber.address,contracts0x["Exchange"],contracts0x["ZRXToken"])),
    ]);

    await Promise.all([
      (oracle = await B0xOracle.new(b0x.address, vault.address, kyber.address,
          {from: accounts[0], value: web3.toWei(10, "ether")}))
    ]);
  });

  it("should add B0x as owner for B0xVault", function(done) {
    vault.setB0xOwner(b0x.address).then(function() {
      vault.b0xContractAddress.call().then(function(owner) {
        assert.equal(owner, b0x.address, "B0x contract should be the owner");
        done();
      });
    }, function(error) {
      console.error(error);
      assert.equal(true, false);
      done();
    });
  });

  it("should add B0x as owner for B0xOracle", function(done) {
    oracle.setB0xOwner(b0x.address).then(function() {
      oracle.b0xContractAddress.call().then(function(owner) {
        assert.equal(owner, b0x.address, "B0x contract should be the owner");
        done();
      });
    }, function(error) {
      console.error(error);
      assert.equal(true, false);
      done();
    });
  });

  */



  before('retrieve all deployed contracts', async function () {
    await Promise.all([
      (b0x_token = await B0xToken.deployed()),
      (vault = await B0xVault.deployed()),
      (exchange0x_wrapper = await B0xTo0x.deployed()),
      (b0x = await B0xSol.deployed()),

      (oracle = await B0xOracle.deployed()),

      (zrx_token = await ERC20.at(contracts0x["ZRXToken"])),
      (exchange_0x = await Exchange0x.at(contracts0x["Exchange"])),
    ]);

  });

  before('update Exchange contract to the deployed version', async function () {
    contracts0x["Exchange"] = await exchange0x_wrapper.EXCHANGE_CONTRACT.call();
  });

  before('retrieve all deployed test tokens', async function () {
    for (var i = 0; i < 10; i++) {
      test_tokens[i] = await artifacts.require("TestToken"+i).deployed();
      console.log("Test Token "+i+" retrieved: "+test_tokens[i].address);
    }
  });




  /*before('deploy ten test tokens', async function () {
    for (var i = 0; i < 10; i++) {
      test_tokens[i] = await BaseToken.new(
        10000000000000000000000000,
        "Test Token "+i,
        18,
        "TEST"+i
      );
      console.log("Test Token "+i+" created: "+test_tokens[i].address);
    }
  });*/

  before('watch events', function () {
    gasRefundEvent = oracle.GasRefund();
    logErrorTextEvent = exchange0x_wrapper.LogErrorAddr();
    logErrorEvent0x = exchange_0x.LogError();
  });

  after(function() {
    new Promise((resolve, reject) => {
      console.log("b0x_tester :: after balance: "+web3.eth.getBalance(accounts[0]));
    });
  });

  /*
  //setup event listener
  var event = b0x.LogErrorText(function(error, result) {
      if (!error)
          console.log(result);
  });
  */

  /*
  it("should retrieve deployed B0xVault contract", function(done) {
    B0xVault.deployed().then(function(instance) {
      vault = instance;
      assert.isOk(vault);
      done();
    });
  });

  it("should retrieve deployed B0x contract", function(done) {
    B0xSol.deployed().then(function(instance) {
      b0x = instance;
      //console.log(b0x.address);
      assert.isOk(b0x);
      done();
    });
  });

  it("should deploy B0xToken contract", function(done) {
    B0xToken.deployed().then(function(instance) {
      b0x_token = instance;
      assert.isOk(b0x_token);
      done();
    });
  });

  */

  /*it("should verify total B0xToken supply", function(done) {
    b0x_token.totalSupply.call().then(function(totalSupply) {
      assert.equal(totalSupply.toNumber(), expected_B0xTokenTotalSupply, "totalSupply should equal B0xTokenTotalSupply");
      done();
    }, function(error) {
      console.error(error);
      assert.equal(true, false);
      done();
    });
  });
  */

  /*it("should retrieve deployed ZRXToken contract", function(done) {
    ERC20.at(contracts0x["ZRXToken"]).then(function(instance) {
      zrx_token = instance;
      //console.log(zrx_token);
      //zrx_token.totalSupply.call().then(function(totalSupply) {
      //  console.log(totalSupply);
      //  done();
      //});
      assert.isOk(zrx_token);
      done();
    });
  });

  it("should retrieve deployed 0x Exchange contract", function(done) {
    Exchange0x.at(contracts0x["Exchange"]).then(function(instance) {
      exchange_0x = instance;
      //console.log(exchange_0x);
      assert.isOk(exchange_0x);
      done();
    });
  });*/


/*
  it("should deposit ether margin", function(done) {
    //var beforeWalletBalance = getWeiBalance(accounts[0]);
    vault.marginBalanceOf.call(0, accounts[0]).then(function(beforeBalance) {
      b0x.depositEtherMargin({from: accounts[0], to: b0x.address, value: testDepositAmount}).then(function(tx) {
        vault.marginBalanceOf.call(0, accounts[0]).then(function(afterBalance) {
          //var totalGas = new BigNumber(tx.receipt.cumulativeGasUsed) * web3.eth.gasPrice.toNumber();
          assert.equal(afterBalance.toNumber(), beforeBalance.add(testDepositAmount).toNumber(), "afterBalance should equal beforeBalance + testDepositAmount");
          //assert.equal(getWeiBalance(accounts[0]), beforeWalletBalance-testDepositAmount-totalGas, "afterWalletBalance should equal beforeWalletBalance - testDepositAmount - totalGas");
          done();
        });
      }, function(error) {
        console.error(error);
        assert.equal(true, false);
        done();
      });
    });
  });

  it("should withdraw ether margin", function(done) {
    vault.marginBalanceOf.call(0, accounts[0]).then(function(beforeBalance) {
      b0x.withdrawEtherMargin(testDepositAmount, {from: accounts[0]}).then(function() {
        vault.marginBalanceOf.call(0, accounts[0]).then(function(afterBalance) {
          assert.equal(afterBalance.toNumber(), beforeBalance.sub(testDepositAmount).toNumber(), "afterBalance should equal beforeBalance - testDepositAmount");
          done();
        });
      }, function(error) {
        console.error(error);
        assert.equal(true, false);
        done();
      });
    });
  });

  it("should deposit ether funding", function(done) {
    vault.fundingBalanceOf.call(0, accounts[0]).then(function(beforeBalance) {
      b0x.depositEtherFunding({from: accounts[0], to: b0x.address, value: testDepositAmount}).then(function() {
        vault.fundingBalanceOf.call(0, accounts[0]).then(function(afterBalance) {
          assert.equal(afterBalance.toNumber(), beforeBalance.add(testDepositAmount).toNumber(), "afterBalance should equal beforeBalance + testDepositAmount");
          done();
        });
      }, function(error) {
        console.error(error);
        assert.equal(true, false);
        done();
      });
    });
  });

  it("should withdraw ether funding", function(done) {
    vault.fundingBalanceOf.call(0, accounts[0]).then(function(beforeBalance) {
      b0x.withdrawEtherFunding(testDepositAmount, {from: accounts[0]}).then(function() {
        vault.fundingBalanceOf.call(0, accounts[0]).then(function(afterBalance) {
          assert.equal(afterBalance.toNumber(), beforeBalance.sub(testDepositAmount).toNumber(), "afterBalance should equal beforeBalance - testDepositAmount");
          done();
        });
      }, function(error) {
        console.error(error);
        assert.equal(true, false);
        done();
      });
    });
  });



  it("should approve b0x Token transfer", function(done) {
    let tmp_b0x = new ERC20(b0x_token.address);
    tmp_b0x.approve(b0x.address, testDepositAmount*2, {from: accounts[0]}).then(function(tx) {
      tmp_b0x.allowance.call(accounts[0], b0x.address).then(function(allowance) {
        assert.equal(allowance, testDepositAmount*2, "allowance should equal testDepositAmount");
        done();
      });
      //assert.isOk(tx.receipt);
      //done();
    }, function(error) {
      console.error(error);
      assert.equal(true, false);
      done();
    });
  });

  it("should deposit b0x Token margin", function(done) {
    vault.marginBalanceOf.call(b0x_token.address, accounts[0]).then(function(beforeBalance) {
      b0x.depositTokenMargin(b0x_token.address, testDepositAmount, {from: accounts[0]}).then(function() {
        vault.marginBalanceOf.call(b0x_token.address, accounts[0]).then(function(afterBalance) {
          assert.equal(afterBalance.toNumber(), beforeBalance.add(testDepositAmount).toNumber(), "afterBalance should equal beforeBalance + testDepositAmount");
          done();
        });
      }, function(error) {
        console.error(error);
        assert.equal(true, false);
        done();
      });
    });
  });

  it("should withdraw b0x Token margin", function(done) {
    b0x_token.balanceOf.call(accounts[0]).then(function(beforeBalance) {
      b0x.withdrawTokenMargin(b0x_token.address, testDepositAmount, {from: accounts[0]}).then(function() {
        b0x_token.balanceOf.call(accounts[0]).then(function(afterBalance) {
          assert.equal(afterBalance.toNumber(), beforeBalance.add(testDepositAmount).toNumber(), "afterBalance should equal beforeBalance + testDepositAmount");
          done();
        });
      }, function(error) {
        console.error(error);
        assert.equal(true, false);
        done();
      });
    });
  });

  it("should deposit b0x Token funding", function(done) {
    vault.fundingBalanceOf.call(b0x_token.address, accounts[0]).then(function(beforeBalance) {
      b0x.depositTokenFunding(b0x_token.address, testDepositAmount, {from: accounts[0]}).then(function() {
        vault.fundingBalanceOf.call(b0x_token.address, accounts[0]).then(function(afterBalance) {
          assert.equal(afterBalance.toNumber(), beforeBalance.add(testDepositAmount).toNumber(), "afterBalance should equal beforeBalance + testDepositAmount");
          done();
        });
      }, function(error) {
        console.error(error);
        assert.equal(true, false);
        done();
      });
    });
  });

  it("should withdraw b0x Token funding", function(done) {
    b0x_token.balanceOf.call(accounts[0]).then(function(beforeBalance) {
      b0x.withdrawTokenFunding(b0x_token.address, testDepositAmount, {from: accounts[0]}).then(function() {
        b0x_token.balanceOf.call(accounts[0]).then(function(afterBalance) {
          assert.equal(afterBalance.toNumber(), beforeBalance.add(testDepositAmount).toNumber(), "afterBalance should equal beforeBalance + testDepositAmount");
          done();
        });
      }, function(error) {
        console.error(error);
        assert.equal(true, false);
        done();
      });
    });
  });
*/

  // not needed since b0x_token is ERC20_AlwaysOwned
  /*
  it("should transfer B0xToken to accounts[1] and accounts[1] approve vault for transfer (for lender)", function(done) {
    var amount = web3.toWei(100000, "ether");
    b0x_token.transfer(accounts[1], amount, {from: accounts[0]}).then(function(result) {
      b0x_token.approve(vault.address, amount, {from: accounts[1]}).then(function(tx) {
  */
        /*b0x_token.allowance.call(accounts[1],b0x.address).then(function(allowance) {
          console.log("allowance: "+allowance);
        });*/

        /*vault.fundingBalanceOf.call(b0x_token.address, accounts[1]).then(function(beforeBalance) {
          //console.log("beforeBalance: "+beforeBalance);
          b0x.depositTokenFunding(b0x_token.address, amount, {from: accounts[1]}).then(function() {
            vault.fundingBalanceOf.call(b0x_token.address, accounts[1]).then(function(afterBalance) {

              //vault.getAuthorizedAddresses.call().then(function(addrs) {
              //  console.log(addrs);
              //  console.log(b0x.address);
              //});

              assert.equal(afterBalance.toNumber(), beforeBalance.add(amount).toNumber(), "afterBalance should equal beforeBalance + 100000");
              done();

            });
          }, function(error) {
            console.error("inner: "+error);
            assert.equal(true, false);
            done();
          });
        });*/ /*
        assert.isOk(tx.receipt);
        done();
      });
    }, function(error) {
      console.error("outer: "+error);
      assert.equal(true, false);
      done();
    });
  }); */

  // not needed since b0x_token is ERC20_AlwaysOwned
  /*
  it("should transfer B0xToken to accounts[2] and accounts[2] approve vault for transfer (for trader)", function(done) {
    var amount = web3.toWei(100000, "ether");
    b0x_token.transfer(accounts[2], amount, {from: accounts[0]}).then(function(result) {
      b0x_token.approve(vault.address, amount, {from: accounts[2]}).then(function(tx) {

        b0x_token.allowance.call(accounts[2],vault.address).then(function(allowance) {
          console.log("allowance: "+allowance);
        });
  */

        /*vault.marginBalanceOf.call(b0x_token.address, accounts[2]).then(function(beforeBalance) {
          b0x.depositTokenMargin(b0x_token.address, amount, {from: accounts[2]}).then(function() {
            vault.marginBalanceOf.call(b0x_token.address, accounts[2]).then(function(afterBalance) {
              assert.equal(afterBalance.toNumber(), beforeBalance.add(amount).toNumber(), "afterBalance should equal beforeBalance + 100000");
              done();
            });
          }, function(error) {
            console.error("inner: "+error);
            assert.equal(true, false);
            done();
          });
        });*/ /*
        assert.isOk(tx.receipt);
        done();
      });
    }, function(error) {
      console.error("outer: "+error);
      assert.equal(true, false);
      done();
    });
  }); */


  /*it("b0x", function(done) {
    b0x.EXCHANGE0X_WRAPPER_CONTRACT.call().then(function(value) {
      console.log(value);
      done();
    }, function(error) {
      console.error(error);
      done();
    });
  });
  it("exchangeWrapper", function(done) {
    exchange0x_wrapper.EXCHANGE_CONTRACT.call().then(function(value) {
      console.log(value);
      done();
    }, function(error) {
      console.error(error);
      done();
    });
  });*/


  it("should generate loanOrderHash (as lender)", function(done) {
    var salt = generatePseudoRandomSalt().toString();
    salt = salt.substring(0,salt.length-10);

    OrderParams_b0x = {
      "b0xAddress": b0x.address,
      "makerAddress": accounts[1], // lender
      "loanTokenAddress": test_tokens[0].address,
      "interestTokenAddress": test_tokens[1].address,
      "collateralTokenAddress": test_tokens[2].address,
      "feeRecipientAddress": accounts[9],
      "oracleAddress": oracle.address,
      "loanTokenAmount": web3.toWei(1000000, "ether").toString(),
      "interestAmount": web3.toWei(2, "ether").toString(), // 2 token units per day
      "initialMarginAmount": "50", // 50%
      "maintenanceMarginAmount": "25", // 25%
      "lenderRelayFee": web3.toWei(0.001, "ether").toString(),
      "traderRelayFee": web3.toWei(0.0015, "ether").toString(),
      "expirationUnixTimestampSec": (web3.eth.getBlock("latest").timestamp+86400).toString(),
      "salt": salt
    };
    console.log(OrderParams_b0x);
    let expectedHash = B0xJS.getLoanOrderHashHex(OrderParams_b0x);
    console.log("js hash: "+expectedHash);
    //console.log(salt);
    //console.log(expirationUnixTimestampSec);
    //console.log(OrderParams_b0x);
    b0x.getLoanOrderHash.call(
      [
        OrderParams_b0x["makerAddress"],
        OrderParams_b0x["loanTokenAddress"],
        OrderParams_b0x["interestTokenAddress"],
        OrderParams_b0x["collateralTokenAddress"],
        OrderParams_b0x["feeRecipientAddress"],
        OrderParams_b0x["oracleAddress"]
      ],
      [
        new BN(OrderParams_b0x["loanTokenAmount"]),
        new BN(OrderParams_b0x["interestAmount"]),
        new BN(OrderParams_b0x["initialMarginAmount"]),
        new BN(OrderParams_b0x["maintenanceMarginAmount"]),
        new BN(OrderParams_b0x["lenderRelayFee"]),
        new BN(OrderParams_b0x["traderRelayFee"]),
        new BN(OrderParams_b0x["expirationUnixTimestampSec"]),
        new BN(OrderParams_b0x["salt"])
    ]).then(function(orderHash) {
      console.log("sol hash: "+orderHash);
      OrderHash_b0x = orderHash;
      assert.equal(orderHash, expectedHash, "expectedHash should equal returned loanOrderHash");
      done();
    }, function(error) {
      console.error(error);
      assert.equal(true, false);
      done();
    });
  });

  it("should sign and verify orderHash", function(done) {
    const nodeVersion = web3.version.node;
    const isParityNode = _.includes(nodeVersion, 'Parity');
    const isTestRpc = _.includes(nodeVersion, 'TestRPC');
    //console.log("isParityNode:" + isParityNode);
    //console.log("isTestRpc:" + isTestRpc);

    if (isParityNode || isTestRpc) {
      // Parity and TestRpc nodes add the personalMessage prefix itself
      ECSignature_raw = web3.eth.sign(accounts[1], OrderHash_b0x);
    }
    else {
      var orderHashBuff = ethUtil.toBuffer(OrderHash_b0x);
      var msgHashBuff = ethUtil.hashPersonalMessage(orderHashBuff);
      var msgHashHex = ethUtil.bufferToHex(msgHashBuff);
      ECSignature_raw = web3.eth.sign(accounts[1], msgHashHex);
    }

    /*ECSignature = {
      "v": parseInt(ECSignature_raw.substring(130,132))+27,
      "r": "0x"+ECSignature_raw.substring(2,66),
      "s": "0x"+ECSignature_raw.substring(66,130)
    };*/

    b0x.isValidSignature.call(
      accounts[1], // lender
      OrderHash_b0x,
      ECSignature_raw
    ).then(function(result) {
      assert.isOk(result);
      done();
    }, function(error) {
      console.error(error);
      assert.isOk(false);
      done();
    });
  });

  /*it("should send sample kyber for B0X", function(done) {
    var expectedPrice = web3.toWei("0.00025998", "ether");
    b0x.testSendPriceUpdate(
      b0x_token.address,
      expectedPrice,
      {from: accounts[0]}).then(function(tx) {
        console.log(txPrettyPrint(tx,"should send sample kyber for B0X",[]));

        kyber.getTokenPrice(b0x_token.address).then(function(currentPrice) {
          assert.equal(currentPrice, expectedPrice, "expectedPrice should equal returned currentPrice");
          done();
        }, function(error) {
          console.error("inner: "+error);
          assert.isOk(false);
          done();
        });
    }, function(error) {
      console.error("outer: "+error);
      assert.isOk(false);
      done();
    });
  });

  it("should send sample kyber prices for Test Token 1", function(done) {
    var expectedPrice = web3.toWei("1.2", "ether");
    b0x.testSendPriceUpdate(
      test_tokens[1].address,
      expectedPrice,
      {from: accounts[0]}).then(function(tx) {
        kyber.getTokenPrice(test_tokens[1].address).then(function(currentPrice) {
          assert.equal(currentPrice, expectedPrice, "expectedPrice should equal returned currentPrice");
          done();
        }, function(error) {
          console.error("inner: "+error);
          assert.isOk(false);
          done();
        });
    }, function(error) {
      console.error("outer: "+error);
      assert.isOk(false);
      done();
    });
  });

  it("should send sample kyber prices for Test Token 0", function(done) {
    var expectedPrice = web3.toWei((0.32+0.75)/2, "ether");
    b0x.testSendPriceUpdate(
      test_tokens[0].address,
      web3.toWei(0.32, "ether"), // simulate price from one source
      {from: accounts[0]}).then(function(tx) {
        //console.log(tx);
        kyber.getTokenPrice(test_tokens[0].address).then(function(currentPrice) {
          //console.log(currentPrice.toString());
          b0x.testSendPriceUpdate(
            test_tokens[0].address,
            web3.toWei(0.75, "ether"), // simulate price from another source
            {from: accounts[7]}).then(function(tx) {
              //console.log(tx);
              kyber.getTokenPrice(test_tokens[0].address).then(function(currentPrice) {
                currentPrice = currentPrice.toString();
                //console.log(currentPrice);
                assert.equal(currentPrice, expectedPrice, "expectedPrice should equal returned currentPrice");
                done();
              }, function(error) {
                console.error("inner 2: "+error);
                assert.isOk(false);
                done();
              });
            }, function(error) {
              console.error("inner 1: "+error);
              assert.isOk(false);
              done();
            });
          });
    }, function(error) {
      console.error("outer: "+error);
      assert.isOk(false);
      done();
    });
  });*/

  it("should take sample lender order as trader", function(done) {
    b0x.takeLoanOrderAsTrader(
      [
        OrderParams_b0x["makerAddress"],
        OrderParams_b0x["loanTokenAddress"],
        OrderParams_b0x["interestTokenAddress"],
        OrderParams_b0x["collateralTokenAddress"],
        OrderParams_b0x["feeRecipientAddress"],
        OrderParams_b0x["oracleAddress"]
      ],
      [
        new BN(OrderParams_b0x["loanTokenAmount"]),
        new BN(OrderParams_b0x["interestAmount"]),
        new BN(OrderParams_b0x["initialMarginAmount"]),
        new BN(OrderParams_b0x["maintenanceMarginAmount"]),
        new BN(OrderParams_b0x["lenderRelayFee"]),
        new BN(OrderParams_b0x["traderRelayFee"]),
        new BN(OrderParams_b0x["expirationUnixTimestampSec"]),
        new BN(OrderParams_b0x["salt"])
      ],
      b0x_token.address,
      web3.toWei(12.3, "ether"),
      ECSignature_raw,
      {from: accounts[2], gas: 5000000, gasPrice: 10000000000}).then(function(tx) {
        tx_obj = tx;
        return gasRefundEvent.get();
      }).then(function(caughtEvents) {
        console.log(txPrettyPrint(tx_obj,"should take sample lender order as trader",caughtEvents));
        assert.isOk(tx_obj);
        done();
      }, function(error) {
        console.error(error);
        assert.isOk(false);
        done();
      });
  });


  it("should send ZRX Token to trader, then approve b0x to transfer for trader for taking 0x trades", function(done) {
    var amount = web3.toWei(10000, "ether");
    zrx_token.transfer(accounts[2], amount, {from: accounts[0]}).then(function(tx) {
      zrx_token.approve(b0x.address, amount, {from: accounts[0]}).then(function(tx) {
        assert.isOk(tx.receipt);
        done();
      }, function(error) {
        console.error("inner: "+error);
        assert.isOk(false);
        done();
      });
    }, function(error) {
      console.error("outer: "+error);
      assert.isOk(false);
      done();
    });
  });


  it("should send ZRX Token to account[7] (maker of 0x sample order)", function(done) {
    var amount = web3.toWei(10000, "ether");
    zrx_token.transfer(accounts[7], amount, {from: accounts[0]}).then(function(tx) {
      assert.isOk(tx.receipt);
      done();
    }, function(error) {
      console.error(error);
      assert.isOk(false);
      done();
    });
  });

  it("should generate 0x order", async function() {
    var salt = generatePseudoRandomSalt().toString();
    salt = salt.substring(0,salt.length-10);

    OrderParams_0x = {
      "exchangeContractAddress": contracts0x["Exchange"],
      "expirationUnixTimestampSec": (web3.eth.getBlock("latest").timestamp+86400).toString(),
      "feeRecipient": "0x0000000000000000000000000000000000000000", //"0x1230000000000000000000000000000000000000",
      "maker": accounts[7],
      "makerFee": web3.toWei(0.002, "ether").toString(),
      "makerTokenAddress": test_tokens[7].address,
      "makerTokenAmount": web3.toWei(100, "ether").toString(),
      "salt": salt,
      "taker": "0x0000000000000000000000000000000000000000",
      "takerFee": web3.toWei(0.0013, "ether").toString(),
      "takerTokenAddress": test_tokens[0].address,
      "takerTokenAmount": web3.toWei(20.1, "ether").toString(),
    };
    console.log(OrderParams_0x);

    OrderHash_0x = ZeroEx.getOrderHashHex(OrderParams_0x);

    assert.isOk(true);
  });

  it("should sign and verify 0x order", function(done) {
    const nodeVersion = web3.version.node;
    const isParityNode = _.includes(nodeVersion, 'Parity');
    const isTestRpc = _.includes(nodeVersion, 'TestRPC');
    //console.log("isParityNode:" + isParityNode);
    //console.log("isTestRpc:" + isTestRpc);

    if (isParityNode || isTestRpc) {
      // Parity and TestRpc nodes add the personalMessage prefix itself
      ECSignature_0x_raw = web3.eth.sign(accounts[7], OrderHash_0x);
    }
    else {
      var orderHashBuff = ethUtil.toBuffer(OrderHash_0x);
      var msgHashBuff = ethUtil.hashPersonalMessage(orderHashBuff);
      var msgHashHex = ethUtil.bufferToHex(msgHashBuff);
      ECSignature_0x_raw = web3.eth.sign(accounts[7], msgHashHex);
    }

    ECSignature_0x = {
      "v": parseInt(ECSignature_0x_raw.substring(130,132))+27,
      "r": "0x"+ECSignature_0x_raw.substring(2,66),
      "s": "0x"+ECSignature_0x_raw.substring(66,130)
    };

    exchange_0x.isValidSignature.call(
      accounts[7],
      OrderHash_0x,
      ECSignature_0x["v"],
      ECSignature_0x["r"],
      ECSignature_0x["s"]
    ).then(function(result) {
      assert.isOk(result);
      done();
    }, function(error) {
      console.error(error);
      assert.isOk(false);
      done();
    });
  });

  it("should open 0x trade with borrowed funds", function(done) {

    var types = ['bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','bytes32'];
    var values = [
      Web3Utils.padLeft(OrderParams_0x["maker"], 64),
      Web3Utils.padLeft(OrderParams_0x["taker"], 64),
      Web3Utils.padLeft(OrderParams_0x["makerTokenAddress"], 64),
      Web3Utils.padLeft(OrderParams_0x["takerTokenAddress"], 64),
      Web3Utils.padLeft(OrderParams_0x["feeRecipient"], 64),
      '0x'+Web3Utils.padLeft(new BN(OrderParams_0x["makerTokenAmount"]), 64),
      '0x'+Web3Utils.padLeft(new BN(OrderParams_0x["takerTokenAmount"]), 64),
      '0x'+Web3Utils.padLeft(new BN(OrderParams_0x["makerFee"]), 64),
      '0x'+Web3Utils.padLeft(new BN(OrderParams_0x["takerFee"]), 64),
      '0x'+Web3Utils.padLeft(new BN(OrderParams_0x["expirationUnixTimestampSec"]), 64),
      '0x'+Web3Utils.padLeft(new BN(OrderParams_0x["salt"]), 64)
    ];

    //console.log(values);
    var hashBuff = ethABI.solidityPack(types, values)
    //console.log(hashBuff);
    var sample_order_tightlypacked = ethUtil.bufferToHex(hashBuff);
    //console.log(sample_order_tightlypacked);

    var textEvents;
    b0x.open0xTrade(
      OrderHash_b0x,
      sample_order_tightlypacked,
      ECSignature_0x_raw,
      {from: accounts[2]}).then(function(tx) {
        tx_obj = tx;
        return logErrorTextEvent.get();
      }).then(function(caughtEvents) {
        console.log(txPrettyPrint(tx_obj,"should open 0x trade with borrowed funds",caughtEvents));
        assert.isOk(tx_obj);
        done();
      }, function(error) {
        console.error(error);
        assert.isOk(false);
        done();
      });
  });



  it("should test LoanOrder bytes", function(done) {
    b0x.getLoanOrderByteData.call(
      OrderHash_b0x,
      {from: accounts[2], gas: 5000000, gasPrice: 8000000000}).then(function(bts) {
        console.log(bts);
        b0x.getLoanOrderLog(
          bts,
          {from: accounts[2], gas: 5000000, gasPrice: 10000000000}).then(function(tx) {
            tx_obj = tx;
            return gasRefundEvent.get();
          }).then(function(caughtEvents) {
            console.log(txPrettyPrint(tx_obj,"should test LoanOrder bytes",caughtEvents));
            assert.isOk(tx_obj);
            done();
          }, function(error) {
            console.error(error);
            assert.isOk(false);
            done();
          });
      });
  });


  it("should test Loan bytes", function(done) {
    b0x.getLoanByteData.call(
      OrderHash_b0x,
      accounts[2],
      {from: accounts[2], gas: 5000000, gasPrice: 8000000000}).then(function(bts) {
        console.log(bts);
        b0x.getLoanLog(
          bts,
          {from: accounts[2], gas: 5000000, gasPrice: 10000000000}).then(function(tx) {
            tx_obj = tx;
            return gasRefundEvent.get();
          }).then(function(caughtEvents) {
            console.log(txPrettyPrint(tx_obj,"should test LoanOrder bytes",caughtEvents));
            assert.isOk(tx_obj);
            done();
          }, function(error) {
            console.error(error);
            assert.isOk(false);
            done();
          });
      });
  });


  it("should test Trade bytes", function(done) {
    b0x.getTradeByteData.call(
      OrderHash_b0x,
      accounts[2],
      {from: accounts[2], gas: 5000000, gasPrice: 8000000000}).then(function(bts) {
        console.log(bts);
        b0x.getTradeLog(
          bts,
          {from: accounts[2], gas: 5000000, gasPrice: 10000000000}).then(function(tx) {
            tx_obj = tx;
            return gasRefundEvent.get();
          }).then(function(caughtEvents) {
            console.log(txPrettyPrint(tx_obj,"should test Trade bytes",caughtEvents));
            assert.isOk(tx_obj);
            done();
          }, function(error) {
            console.error(error);
            assert.isOk(false);
            done();
          });
      });
  });




/*
  it("should test Loan bytes", function(done) {
    b0x.getLoanByteData.call(
      OrderHash_b0x,
      accounts[2],
      {from: accounts[2], gas: 5000000, gasPrice: 200000000000}).then(function(bts) {
        console.log(bts);
        b0x.getLoanFromBytes.call(
          bts,
          {from: accounts[2], gas: 5000000, gasPrice: 10000000000}).then(function(obj) {
            console.log(obj);
            assert.isOk(true);
            done();
          }, function(error) {
            console.error(error);
            assert.isOk(false);
            done();
          });
      });
  });
*/
/*
  it("should test Trade bytes", function(done) {
    b0x.getTradeByteData.call(
      OrderHash_b0x,
      accounts[2],
      {from: accounts[2], gas: 5000000, gasPrice: 200000000000}).then(function(bts) {
        console.log(bts);

        b0x.getTradeLog(
          bts,
          {from: accounts[2], gas: 5000000, gasPrice: 10000000000}).then(function(tx) {
            tx_obj = tx;
            return gasRefundEvent.get();
          }).then(function(caughtEvents) {
            console.log(txPrettyPrint(tx_obj,"should test Trade bytes",caughtEvents));
            assert.isOk(tx_obj);
            done();
          }, function(error) {
            console.error(error);
            assert.isOk(false);
            done();
          });
      });
  });
*/


  function txPrettyPrint(tx, desc, events) {
    var ret = desc + "\n";
    if (tx.tx === undefined) {
      ret = ret + JSON.stringify(tx);
    } else {
      ret = ret + "  tx: "+tx.tx+"\n";
      if (tx.receipt !== undefined) {
        ret = ret + "  blockNumber: "+tx.receipt.blockNumber+"\n";
        ret = ret + "  gasUsed: "+tx.receipt.gasUsed+" -> x"+currentGasPrice+" = "+(tx.receipt.gasUsed*currentGasPrice)+" ("+(tx.receipt.gasUsed*currentGasPrice/1e18*currentEthPrice).toFixed(2)+"USD @ "+currentEthPrice+"ETH/USD)\n";
        ret = ret + "  cumulativeGasUsed: "+tx.receipt.cumulativeGasUsed+" -> x"+currentGasPrice+" = "+(tx.receipt.cumulativeGasUsed*currentGasPrice)+" ("+(tx.receipt.cumulativeGasUsed*currentGasPrice/1e18*currentEthPrice).toFixed(2)+"USD @ "+currentEthPrice+"ETH/USD)\n";
        ret = ret + "  status: "+tx.receipt.status+"\n";
      }

      if (tx.logs === undefined) {
        tx.logs = [];
      }
      tx.logs = tx.logs.concat(events);

      if (tx.logs.length > 0) {
        ret = ret + "  LOGS --> "+"\n";
        for (var i=0; i < tx.logs.length; i++) {
          ret = ret + "  "+i+": "+tx.logs[i].event+" "+JSON.stringify(tx.logs[i].args);
          if (tx.logs[i].event == "GasRefund") {
            ret = ret + " -> Refund: "+(tx.logs[i].args.refundAmount/1e18*currentEthPrice).toFixed(2)+"USD @ "+currentEthPrice+"ETH/USD)\n";
          }
          else {
            ret = ret + "\n";
          }


        }
      }
    }
    return ret;
  }

  function printBalances(accounts) {
    accounts.forEach(function(ac, i) {
      console.log(accounts[i],": ", web3.fromWei(web3.eth.getBalance(ac), 'ether').toNumber());
    });
  }

  function getWeiBalance(account) {
    return web3.eth.getBalance(account).toNumber();
  }

  function generatePseudoRandomSalt() {
    // BigNumber.random returns a pseudo-random number between 0 & 1 with a passed in number of decimal places.
    // Source: https://mikemcl.github.io/bignumber.js/#random
    let MAX_DIGITS_IN_UNSIGNED_256_INT = 78;
    var randomNumber = BigNumber.random(MAX_DIGITS_IN_UNSIGNED_256_INT);
    var factor = new BigNumber(10).pow(MAX_DIGITS_IN_UNSIGNED_256_INT - 1);
    var salt = randomNumber.times(factor).round();
    return salt;
  };

  function encodeFunctionTxData(functionName, types, args) {
    var fullName = functionName + '(' + types.join() + ')';
    var signature = CryptoJS.SHA3(fullName, { outputLength: 256 }).toString(CryptoJS.enc.Hex).slice(0, 8);
    var dataHex = signature + coder.encodeParams(types, args);

    return dataHex;
  }
});
