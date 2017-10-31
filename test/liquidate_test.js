const BigNumber = require('bignumber.js');
const BN = require('bn.js');
const ethUtil = require('ethereumjs-util');
//const TestRPC = require('ethereumjs-testrpc');
//const Transaction = require('ethereumjs-tx');
//const coder = require('web3/lib/solidity/coder');
//const CryptoJS = require('crypto-js');
//const Web3 = require('web3');

//var provider = TestRPC.provider();
//let web3 = new Web3(provider);
//let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))


//import { Broker0x } from '../src/Broker0x.js';
// require('../src/B0x.js');


let B0xVault = artifacts.require("./B0xVault.sol");
let B0xPrices = artifacts.require("./B0xPrices.sol");
let B0xSol = artifacts.require("./B0x.sol");
let LOANToken = artifacts.require("./LOANToken.sol");
let ERC20 = artifacts.require("./ERC20.sol"); // for testing with any ERC20 token

let TomToken = artifacts.require("./TomToken.sol");
let BeanToken = artifacts.require("./BeanToken.sol");

let DexA = artifacts.require("./DexA.sol");
//let DexB = artifacts.require("./DexB.sol");
//let DexC = artifacts.require("./DexC.sol");

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

contract('Liquidate_Test', function(accounts) {
  var vault;
  var broker;
  var prices;
  var loan_token;
  var tom_token;
  var bean_token;
  var dexA;

  //printBalances(accounts);

  before(function() {
    new Promise((resolve, reject) => {
      console.log("before balance: "+web3.eth.getBalance(accounts[0]));
    });
  });

  after(function() {
    new Promise((resolve, reject) => {
      console.log("after balance: "+web3.eth.getBalance(accounts[0]));
    });
  });

  it("should retrieve deployed B0xVault contract", function(done) {
    B0xVault.deployed().then(function(instance) {
      vault = instance;
      assert.isOk(vault);
      done();
    });
  });

  it("should retrieve deployed B0xPrices contract", function(done) {
    B0xPrices.deployed().then(function(instance) {
      prices = instance;
      assert.isOk(vault);
      done();
    });
  });

  it("should retrieve deployed B0x contract", function(done) {
    B0xSol.deployed().then(function(instance) {
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

  it("should retrieve deployed LOANToken contract", function(done) {
    LOANToken.deployed().then(function(instance) {
      loan_token = instance;
      assert.isOk(loan_token);
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

  it("should retrieve deployed DexA contract", function(done) {
    DexA.deployed().then(function(instance) {
      dexA = instance;
      assert.isOk(dexA);
      done();
    });
  });


  it('is should create sample prices for tokens', async function () {
    
    //await dexA.genTokenPrice(loan_token.address, { from: accounts[0] });
    //var DexA_LOAN_price = await dexA.getTokenPrice.call(loan_token.address);
    //console.log(DexA_LOAN_price.toString());
    await dexA.genTokenPrice(loan_token.address, { from: accounts[0] });
    var DexA_LOAN_price = await dexA.getTokenPrice.call(loan_token.address);
    assert.isAbove(DexA_LOAN_price.toNumber(), 0);

    await dexA.genTokenPrice(tom_token.address, { from: accounts[0] });
    var DexA_TOM_price = await dexA.getTokenPrice.call(tom_token.address);
    assert.isAbove(DexA_TOM_price.toNumber(), 0);

    await dexA.genTokenPrice(bean_token.address, { from: accounts[0] });
    var DexA_BEAN_price = await dexA.getTokenPrice.call(bean_token.address);
    assert.isAbove(DexA_BEAN_price.toNumber(), 0);

    /*try {
      var result = await dexA.genTokenPrice(loan_token.address, { from: accounts[1] });
      console.log(result);
    } catch (error) {
      console.log(error.toString());
      //assert(error.toString().includes('invalid opcode'), error.toString());
    }*/

    /*await fundRaise.pause()

    try {
        await fundRaise.sendTransaction({ value: 1e+18, from: donor })
        assert.fail()
    } catch (error) {
        assert(error.toString().includes('invalid opcode'), error.toString())
    }
    const fundRaiseAddress = await fundRaise.address
    assert.equal(web3.eth.getBalance(fundRaiseAddress).toNumber(), 0)

    await fundRaise.unpause()
    await fundRaise.sendTransaction({ value: 1e+18, from: donor })
    assert.equal(web3.eth.getBalance(fundRaiseAddress).toNumber(), 1e+18)*/
  });

  /*
  it("should send sample prices for LOAN", function(done) {
    var expectedPrice = web3.toWei("0.00025998", "ether");
    broker.testSendPriceUpdate(
      loan_token.address, 
      expectedPrice,
      {from: accounts[0]}).then(function(tx) {
        prices.getTokenPrice(loan_token.address).then(function(currentPrice) {
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

  it("should send sample prices for BEAN", function(done) {
    var expectedPrice = web3.toWei("1.2", "ether");
    broker.testSendPriceUpdate(
      bean_token.address, 
      expectedPrice,
      {from: accounts[0]}).then(function(tx) {
        prices.getTokenPrice(bean_token.address).then(function(currentPrice) {
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

  it("should send sample prices for Tom", function(done) {
    var expectedPrice = web3.toWei((0.32+0.75)/2, "ether");
    broker.testSendPriceUpdate(
      tom_token.address, 
      web3.toWei(0.32, "ether"), // simulate price from one source
      {from: accounts[0]}).then(function(tx) {
        //console.log(tx);
        prices.getTokenPrice(tom_token.address).then(function(currentPrice) {
          //console.log(currentPrice.toString());
          broker.testSendPriceUpdate(
            tom_token.address, 
            web3.toWei(0.75, "ether"), // simulate price from another source
            {from: accounts[7]}).then(function(tx) {
              //console.log(tx);
              prices.getTokenPrice(tom_token.address).then(function(currentPrice) {
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
  });
  */

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
