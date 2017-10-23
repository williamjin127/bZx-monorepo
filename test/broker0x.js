const BigNumber = require('bignumber.js');
const BN = require('bn.js');
const ethUtil = require('ethereumjs-util');
//const TestRPC = require('ethereumjs-testrpc');
//const Transaction = require('ethereumjs-tx');
//const coder = require('web3/lib/solidity/coder');
//const CryptoJS = require('crypto-js');
const Web3 = require('web3');

//var provider = TestRPC.provider();
//let web3 = new Web3(provider);
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))


import { Broker0x } from '../src/Broker0x.js';
// require('../src/Broker0x.js');


let Broker0xVault = artifacts.require("./Broker0xVault.sol");
let Broker0xSol = artifacts.require("./Broker0x.sol");
let RESTToken = artifacts.require("./RESTToken.sol");
let ERC20 = artifacts.require("./ERC20.sol"); // for testing with any ERC20 token

let TomToken = artifacts.require("./TomToken.sol");
let BeanToken = artifacts.require("./BeanToken.sol");

let testDepositAmount = web3.toWei(0.001, "ether");
let expected_RESTTokenTotalSupply = web3.toWei(20000000, "ether"); // 20MM REST

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

contract('Broker0xTest', function(accounts) {
  var vault;
  var broker;
  var rest_token;
  var tom_token;
  var bean_token;
  var brokerjs;

  var orderParams;
  var sample_orderhash;
  var ECSignature;

  //printBalances(accounts);

  before(function() {
    new Promise((resolve, reject) => {
      const gasPrice = new BigNumber(web3.toWei(2, 'gwei'));
      brokerjs = new Broker0x(web3.currentProvider, { gasPrice });
      resolve(brokerjs);
    });
  });

  it("should retrieve deployed Broker0xVault contract", function(done) {
    Broker0xVault.deployed().then(function(instance) {
      vault = instance;
      assert.isOk(vault);
      done();
    });
  });

  it("should retrieve deployed Broker0x contract", function(done) {
    Broker0xSol.deployed().then(function(instance) {
      broker = instance;

      /*
      setup event listener
      var event = broker.LogErrorText(function(error, result) {
          if (!error)
              console.log(result);
      });
      */

      assert.isOk(broker);
      done();
    });
  });

  it("should retrieve deployed RESTToken contract and transfer to test accounts", function(done) {
    RESTToken.deployed().then(function(instance) {
      rest_token = instance;
      assert.isOk(rest_token);
      done();
    });
  });

  it("should retrieve deployed TomToken contract", function(done) {
    TomToken.deployed().then(function(instance) {
      tom_token = instance;
      assert.isOk(tom_token);
      done();
    });
  });

  it("should retrieve deployed BeanToken contract", function(done) {
    BeanToken.deployed().then(function(instance) {
      bean_token = instance;
      assert.isOk(bean_token);
      done();
    });
  });

  it("should verify total RESTToken supply", function(done) {
    rest_token.totalSupply.call().then(function(totalSupply) {
      assert.equal(totalSupply.toNumber(), expected_RESTTokenTotalSupply, "totalSupply should equal RESTTokenTotalSupply");
      done();
    }, function(error) {
      console.error(error);
      assert.equal(true, false);
      done();
    });
  });

  it("should add Broker0x as authorized address for Broker0xVault", function(done) {
    vault.addAuthorizedAddress(broker.address).then(function() {
      vault.getAuthorizedAddresses.call().then(function(authorities) {
        assert.equal(authorities[0], broker.address, "Broker0x contract should be the authorized address");
        done();
      });
    }, function(error) {
      console.error(error);
      assert.equal(true, false);
      done();
    });
  });
/*
  it("should deposit ether margin", function(done) {
    //var beforeWalletBalance = getWeiBalance(accounts[0]);
    vault.marginBalanceOf.call(0, accounts[0]).then(function(beforeBalance) {
      broker.depositEtherMargin({from: accounts[0], to: broker.address, value: testDepositAmount}).then(function(tx) {
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
      broker.withdrawEtherMargin(testDepositAmount, {from: accounts[0]}).then(function() {
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
      broker.depositEtherFunding({from: accounts[0], to: broker.address, value: testDepositAmount}).then(function() {
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
      broker.withdrawEtherFunding(testDepositAmount, {from: accounts[0]}).then(function() {
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



  it("should approve REST Token transfer", function(done) {
    let tmp_rest = new ERC20(rest_token.address);
    tmp_rest.approve(broker.address, testDepositAmount*2, {from: accounts[0]}).then(function(tx) {
      tmp_rest.allowance.call(accounts[0], broker.address).then(function(allowance) {
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
  
  it("should deposit REST Token margin", function(done) {
    vault.marginBalanceOf.call(rest_token.address, accounts[0]).then(function(beforeBalance) {
      broker.depositTokenMargin(rest_token.address, testDepositAmount, {from: accounts[0]}).then(function() {
        vault.marginBalanceOf.call(rest_token.address, accounts[0]).then(function(afterBalance) {
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

  it("should withdraw REST Token margin", function(done) {
    rest_token.balanceOf.call(accounts[0]).then(function(beforeBalance) {
      broker.withdrawTokenMargin(rest_token.address, testDepositAmount, {from: accounts[0]}).then(function() {
        rest_token.balanceOf.call(accounts[0]).then(function(afterBalance) {
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

  it("should deposit REST Token funding", function(done) {
    vault.fundingBalanceOf.call(rest_token.address, accounts[0]).then(function(beforeBalance) {
      broker.depositTokenFunding(rest_token.address, testDepositAmount, {from: accounts[0]}).then(function() {
        vault.fundingBalanceOf.call(rest_token.address, accounts[0]).then(function(afterBalance) {
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

  it("should withdraw REST Token funding", function(done) {
    rest_token.balanceOf.call(accounts[0]).then(function(beforeBalance) {
      broker.withdrawTokenFunding(rest_token.address, testDepositAmount, {from: accounts[0]}).then(function() {
        rest_token.balanceOf.call(accounts[0]).then(function(afterBalance) {
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
  it("should transfer RESTToken to accounts[1] and accounts[1] deposit to funding", function(done) {
    var amount = web3.toWei(100000, "ether");
    rest_token.transfer(accounts[1], amount, {from: accounts[0]}).then(function(result) {
      rest_token.approve(broker.address, amount, {from: accounts[1]}).then(function(tx) {
        vault.fundingBalanceOf.call(rest_token.address, accounts[1]).then(function(beforeBalance) {
          broker.depositTokenFunding(rest_token.address, amount, {from: accounts[1]}).then(function() {
            vault.fundingBalanceOf.call(rest_token.address, accounts[1]).then(function(afterBalance) {
              assert.equal(afterBalance.toNumber(), beforeBalance.add(amount).toNumber(), "afterBalance should equal beforeBalance + 100000");
              done();
            });
          }, function(error) {
            console.error("inner: "+error);
            assert.equal(true, false);
            done();
          });
        });
      });
    }, function(error) {
      console.error("outer: "+error);
      assert.equal(true, false);
      done();
    });
  });

  it("should transfer RESTToken to accounts[2] and accounts[2] deposit to margin", function(done) {
    var amount = web3.toWei(100000, "ether");
    rest_token.transfer(accounts[2], amount, {from: accounts[0]}).then(function(result) {
      rest_token.approve(broker.address, amount, {from: accounts[2]}).then(function(tx) {
        vault.marginBalanceOf.call(rest_token.address, accounts[2]).then(function(beforeBalance) {
          broker.depositTokenMargin(rest_token.address, amount, {from: accounts[2]}).then(function() {
            vault.marginBalanceOf.call(rest_token.address, accounts[2]).then(function(afterBalance) {
              assert.equal(afterBalance.toNumber(), beforeBalance.add(amount).toNumber(), "afterBalance should equal beforeBalance + 100000");
              done();
            });
          }, function(error) {
            console.error("inner: "+error);
            assert.equal(true, false);
            done();
          });
        });
      });
    }, function(error) {
      console.error("outer: "+error);
      assert.equal(true, false);
      done();
    });
  });

  it("should deposit Tom Token funding", function(done) {
    var amount = web3.toWei(1000000, "ether");
    tom_token.approve(broker.address, amount, {from: accounts[1]}).then(function(tx) {
      broker.depositTokenFunding(tom_token.address, amount, {from: accounts[1]}).then(function(tx) {
        assert.isOk(tx.receipt);
        done();
      }, function(error) {
        console.error("inner: "+error);
        assert.equal(true, false);
        done();
      });
    }, function(error) {
      console.error("outer: "+error);
      assert.equal(true, false);
      done();
    });
  });


  it("should generate orderHash as lender", function(done) {
    var salt = generatePseudoRandomSalt().toString();
    salt = salt.substring(0,salt.length-10);
  
    orderParams = {
      "broker0xContractAddress": broker.address, 
      "maker": accounts[1], // lender
      "makerTokenAddress": tom_token.address,
      "interestTokenAddress": rest_token.address,
      "oracleAddress": "0x0000000000000000000000000000000000000000", 
      "feeRecipient": accounts[9], 
      "makerTokenAmount": web3.toWei(1000000, "ether").toString(), 
      "lendingLengthSec": "432000", // 5 day
      "interestAmount": web3.toWei(2, "ether").toString(), // 2 token units per day
      "initialMarginAmount": "50", // 50% 
      "liquidationMarginAmount": "25", // 25% 
      "lenderRelayFee": web3.toWei(0.001, "ether").toString(), 
      "borrowerRelayFee": web3.toWei(0.0015, "ether").toString(), 
      "expirationUnixTimestampSec": (web3.eth.getBlock("latest").timestamp+86400).toString(), 
      "reinvestAllowed": "1", 
      "salt": salt
    };
    //console.log(orderParams);
    let expectedHash = brokerjs.getTradeOrderHashHex(orderParams);

    //console.log(salt);
    //console.log(expirationUnixTimestampSec);
    //console.log(orderParams);
    broker.getTradeOrderHash.call(
      [
        orderParams["maker"],
        orderParams["makerTokenAddress"],
        orderParams["interestTokenAddress"],
        orderParams["oracleAddress"],
        orderParams["feeRecipient"],
      ],
      [
        new BN(orderParams["makerTokenAmount"]),
        new BN(orderParams["lendingLengthSec"]),
        new BN(orderParams["interestAmount"]),
        new BN(orderParams["initialMarginAmount"]),
        new BN(orderParams["liquidationMarginAmount"]),
        new BN(orderParams["lenderRelayFee"]),
        new BN(orderParams["borrowerRelayFee"]),
        new BN(orderParams["expirationUnixTimestampSec"]),
        new BN(orderParams["reinvestAllowed"]),
        new BN(orderParams["salt"])
    ]).then(function(orderHash) {
      //console.log("sol hash: "+orderHash);
      sample_orderhash = orderHash;
      assert.equal(orderHash, expectedHash, "expectedHash should equal returned orderHash");
      done();
    }, function(error) {
      console.error(error);
      assert.equal(true, false);
      done();
    });
  });

  it("should sign and verify orderHash", function(done) {
    var orderHashBuff = ethUtil.toBuffer(sample_orderhash);
    var msgHashBuff = ethUtil.hashPersonalMessage(orderHashBuff);
    var msgHashHex = ethUtil.bufferToHex(msgHashBuff);

    var signedOrderHash = web3.eth.sign(accounts[2], msgHashHex);
    //console.log(signedOrderHash);

    ECSignature = {
      "v": parseInt(signedOrderHash.substring(130,132))+27,
      "r": "0x"+signedOrderHash.substring(2,66),
      "s": "0x"+signedOrderHash.substring(66,130)
    };

    broker.isValidSignature.call(
      accounts[2],
      sample_orderhash,
      ECSignature["v"],
      ECSignature["r"],
      ECSignature["s"]
    ).then(function(result) {
      assert.isOk(result);
      done();
    }, function(error) {
      console.error(error);
      assert.equal(true, false);
      done();
    });
  });

  it("should take sample trade as borrower", function(done) {
    broker.fillTrade.call(
      [
        orderParams["maker"],
        orderParams["makerTokenAddress"],
        orderParams["interestTokenAddress"],
        orderParams["oracleAddress"],
        orderParams["feeRecipient"],
      ],
      [
        new BN(orderParams["makerTokenAmount"]),
        new BN(orderParams["lendingLengthSec"]),
        new BN(orderParams["interestAmount"]),
        new BN(orderParams["initialMarginAmount"]),
        new BN(orderParams["liquidationMarginAmount"]),
        new BN(orderParams["lenderRelayFee"]),
        new BN(orderParams["borrowerRelayFee"]),
        new BN(orderParams["expirationUnixTimestampSec"]),
        new BN(orderParams["reinvestAllowed"]),
        new BN(orderParams["salt"])
      ],
      rest_token.address, // taker (borrower) using REST as their margin token in this test
      web3.toWei(2500, "ether"),//(new BN(web3.toWei(2500, "ether").toString())),
      true, // borrowerIsTaker=true
      ECSignature["v"],
      ECSignature["r"],
      ECSignature["s"],
      {from: accounts[2]}).then(function(result) {
        console.log(result);
        assert.isOk(result);
        done();
    }, function(error) {
      console.error(error);
      assert.isOk(false);
      done();
    });
  });

  

  /*it("should sign orderHash", function(done) {
    brokerjs.signOrderHashAsync(sample_orderhash, accounts[1]).then(function(res) {
      console.log(res);
      assert.equal(true, true);
      done();
    });
  });*/

/*  it("should sign orderHash", function(done) {
    web3.eth.getTransactionCountAsync(accounts[1]).then(function(nonce) {
      var data = '0x' + encodeFunctionTxData('register', ['uint256'], [testNum])
      var tx = new Transaction({
        nonce: web3.toHex(nonce),
        gasPrice: gasPriceHex,
        gasLimit: gasLimitHex,
        to: walletContractAddress,
        from: fromAccount,
        value: '0x00',
        data: payloadData
      
        to: broker.address,
      value: 0,
      nonce: nonce,
      data: data,
      gasLimit: 2000000
    })
    tx.sign(Buffer.from(keypair.privateKey.slice(2), 'hex'))
    var signedRawTx = tx.serialize().toString('hex')
      

  }).then(nonce => {
    
  
    return web3.eth.sendRawTransactionAsync(signedRawTx)
  }).then(txHash => {
    return web3.eth.getTransactionReceiptAsync(txHash)
  }).then(tx => {
    console.log('Gas used: ' + tx.gasUsed)

  });*/

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
