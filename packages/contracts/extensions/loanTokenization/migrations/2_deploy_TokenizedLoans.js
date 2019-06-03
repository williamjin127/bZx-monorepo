
const contract = require("truffle-contract");
const fs = require("fs").promises;
const Web3Utils = require("web3-utils");

const networkIds = {
  mainnet: 1,
  ropsten: 3,
  rinkeby: 4,
  kovan: 42,
  development: 50,
};

let BZxOracle;

let BZxProxy = contract(require("../../../build/contracts/BZxProxy.json"));
let BZxVault = contract(require("../../../build/contracts/BZxVault.json"));
let LoanToken = artifacts.require("LoanToken");
let PositionToken = artifacts.require("PositionToken");
let LoanTokenLogic = artifacts.require("LoanTokenLogic");
let EtherLoanTokenLogic = artifacts.require("EtherLoanTokenLogic");
let PositionTokenLogic = artifacts.require("PositionTokenLogic");
let TokenizedRegistry = artifacts.require("TokenizedRegistry");

let tokenized_registry_address, etherLoanTokenLogic, loanTokenLogic, positionTokenLogic;

const path = require("path");
let config = require("../../../protocol-config.js");

module.exports = function(deployer, network, accounts) {

  return;

  network = network.replace("-fork", "");
  if (network == "development" || network == "develop" || network == "testnet" || network == "coverage") {
    network = "development";
  }

  if (network == "mainnet" || network == "ropsten") {
    tokenized_registry_address = config["addresses"][network]["TokenizedRegistry"];
  } else {
    tokenized_registry_address = TokenizedRegistry.address;
  }

  if (network == "mainnet" || network == "ropsten" || network == "kovan") {
    BZxOracle = contract(require("../../../build/contracts/BZxOracle.json"));
  } else {
    BZxOracle = contract(require("../../../build/contracts/TestNetOracle.json"));
  }

  BZxProxy.setNetwork(networkIds[network]);
  BZxVault.setNetwork(networkIds[network]);
  BZxOracle.setNetwork(networkIds[network]);

  let weth_token_address,
    dai_token_address,
    usdc_token_address,
    wbtc_token_address,
    bat_token_address,
    knc_token_address,
    rep_token_address,
    zrx_token_address;
  if (network == "mainnet" || network == "ropsten" || network == "kovan" || network == "rinkeby") {
    weth_token_address = config["addresses"][network]["ZeroEx"]["WETH9"];
    dai_token_address = config["addresses"][network]["DAITokenAddress"];
    usdc_token_address = config["addresses"][network]["USDCTokenAddress"];
    wbtc_token_address = config["addresses"][network]["WBTCTokenAddress"];
    bat_token_address = config["addresses"][network]["BATTokenAddress"];
    knc_token_address = config["addresses"][network]["KNCTokenAddress"];
    rep_token_address = config["addresses"][network]["REPTokenAddress"];
    zrx_token_address = config["addresses"][network]["ZRXTokenAddress"];
  } else {
    weth_token_address = config["addresses"][network]["ZeroEx"]["WETH9"]; //BZxEther.address;

    let t = contract(require("../../../build/contracts/TestToken9.json"));
    t.setNetwork(networkIds[network]);
    dai_token_address = t.address;

    t = contract(require("../../../build/contracts/TestToken8.json"));
    t.setNetwork(networkIds[network]);
    usdc_token_address = t.address;
  }


  deployer.then(async function() {

    await fs.appendFile("TokenizedLoans_"+network+".log", "-------\n");

    //console.log("Deploying bZx ETH iToken.");
    /*let iETH = await deployIToken(
      "bZx ETH iToken",
      "iETH",
      weth_token_address
    );*/
    //let iETH = await EtherLoanTokenLogic.at("0x77f973fcaf871459aa58cd81881ce453759281bc");

    console.log("Deploying bZx DAI iToken.");
    /*let iDAI = await deployIToken(
      "bZx DAI iToken",
      "iDAI",
      dai_token_address
    );*/
    let iDAI = await LoanTokenLogic.at("0x14094949152eddbfcd073717200da82fed8dc960");


    //console.log("Deploying bZx USDC iToken.");
    /*let iUSDC = await deployIToken(
      "bZx USDC iToken",
      "iUSDC",
      usdc_token_address
    );*/
    //let iUSDC = await LoanTokenLogic.at("0xF013406A0B1d544238083DF0B93ad0d2cBE0f65f");


    console.log("Deploying bZx ETH iToken.");
    let iETH = await EtherLoanTokenLogic.at("0x77f973fcaf871459aa58cd81881ce453759281bc");

    console.log("Deploying bZx WBTC iToken.");
    let iWBTC = await LoanTokenLogic.at("0xba9262578efef8b3aff7f60cd629d6cc8859c8b5");

    console.log("Deploying bZx ZRX iToken.");
    let iZRX = await LoanTokenLogic.at("0xa7eb2bc82df18013ecc2a6c533fc29446442edee");

    console.log("Deploying bZx BAT iToken.");
    let iBAT = await LoanTokenLogic.at("0xa8b65249de7f85494bc1fe75f525f568aa7dfa39");

    console.log("Deploying bZx KNC iToken.");
    let iKNC = await LoanTokenLogic.at("0x1cc9567ea2eb740824a45f8026ccf8e46973234d");

    console.log("Deploying bZx REP iToken.");
    let iREP = await LoanTokenLogic.at("0xbd56e9477fc6997609cf45f84795efbdac642ff1");

    /*
    if (network == "mainnet") {
      console.log("Deploying bZx WBTC iToken.");
      let iWBTC = await deployIToken(
        "bZx WBTC iToken",
        "iWBTC",
        wbtc_token_address
      );
      //let iWBTC = await LoanTokenLogic.at("0xba9262578efef8b3aff7f60cd629d6cc8859c8b5");

      console.log("Deploying bZx BAT iToken.");
      let iBAT = await deployIToken(
        "bZx BAT iToken",
        "iBAT",
        bat_token_address
      );
      //let iBAT = await LoanTokenLogic.at("0xFCE3aEeEC8EB39304ED423c0d23c0A978DA9E934");

      console.log("Deploying bZx KNC iToken.");
      let iKNC = await deployIToken(
        "bZx KNC iToken",
        "iKNC",
        knc_token_address
      );
      //let iKNC = await LoanTokenLogic.at("0xFCE3aEeEC8EB39304ED423c0d23c0A978DA9E934");

      console.log("Deploying bZx REP iToken.");
      let iREP = await deployIToken(
        "bZx REP iToken",
        "iREP",
        rep_token_address
      );
      //let iREP = await LoanTokenLogic.at("0xFCE3aEeEC8EB39304ED423c0d23c0A978DA9E934");

      console.log("Deploying bZx ZRX iToken.");
      let iZRX = await deployIToken(
        "bZx ZRX iToken",
        "iZRX",
        zrx_token_address
      );
      //let iZRX = await LoanTokenLogic.at("0xFCE3aEeEC8EB39304ED423c0d23c0A978DA9E934");
    }
    */

    /*for (let leverageAmount=1; leverageAmount <= 4; leverageAmount++) {
      //if (leverageAmount <= 2)
      //  continue;

      await deployPToken(
        leverageAmount,
        "ETH", // assetSymbol
        "short", // type
        weth_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iETH // loanTokenDeployed <-- should be same as assetSymbol
      );

      await deployPToken(
        leverageAmount,
        "ETH", // assetSymbol
        "long", // type
        weth_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iDAI // loanTokenDeployed <-- should be same as unitOfAccountToken
      );
    }*/

    /*for (let leverageAmount=1; leverageAmount <= 4; leverageAmount++) {
      //if (leverageAmount <= 2)
      //  continue;

      await deployPToken(
        leverageAmount,
        "WBTC", // assetSymbol
        "short", // type
        wbtc_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iWBTC // loanTokenDeployed <-- should be same as assetSymbol
      );

      await deployPToken(
        leverageAmount,
        "WBTC", // assetSymbol
        "long", // type
        wbtc_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iDAI // loanTokenDeployed <-- should be same as unitOfAccountToken
      );
    }*/

    /*for (let leverageAmount=1; leverageAmount <= 4; leverageAmount++) {
      //if (leverageAmount <= 2)
      //  continue;

      await deployPToken(
        leverageAmount,
        "ZRX", // assetSymbol
        "short", // type
        zrx_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iZRX // loanTokenDeployed <-- should be same as assetSymbol
      );

      await deployPToken(
        leverageAmount,
        "ZRX", // assetSymbol
        "long", // type
        zrx_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iDAI // loanTokenDeployed <-- should be same as unitOfAccountToken
      );
    }*/

    /*for (let leverageAmount=1; leverageAmount <= 4; leverageAmount++) {
      //if (leverageAmount <= 2)
      //  continue;

      await deployPToken(
        leverageAmount,
        "BAT", // assetSymbol
        "short", // type
        bat_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iBAT // loanTokenDeployed <-- should be same as assetSymbol
      );

      await deployPToken(
        leverageAmount,
        "BAT", // assetSymbol
        "long", // type
        bat_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iDAI // loanTokenDeployed <-- should be same as unitOfAccountToken
      );
    }*/

    for (let leverageAmount=1; leverageAmount <= 4; leverageAmount++) {
      //if (leverageAmount <= 3)
      //  continue;

      await deployPToken(
        leverageAmount,
        "KNC", // assetSymbol
        "short", // type
        knc_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iKNC // loanTokenDeployed <-- should be same as assetSymbol
      );

      await deployPToken(
        leverageAmount,
        "KNC", // assetSymbol
        "long", // type
        knc_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iDAI // loanTokenDeployed <-- should be same as unitOfAccountToken
      );
    }

    for (let leverageAmount=1; leverageAmount <= 4; leverageAmount++) {
      //if (leverageAmount <= 2)
      //  continue;

      await deployPToken(
        leverageAmount,
        "REP", // assetSymbol
        "short", // type
        rep_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iREP // loanTokenDeployed <-- should be same as assetSymbol
      );

      await deployPToken(
        leverageAmount,
        "REP", // assetSymbol
        "long", // type
        rep_token_address, // baseTokenAddress
        dai_token_address, // unitOfAccountTokenAddress
        "DAI", // unitOfAccountToken
        iDAI // loanTokenDeployed <-- should be same as unitOfAccountToken
      );
    }

    async function deployIToken(
      name,
      symbol,
      loanTokenAddress
    ) 
    {
      let logicContract;
      if (symbol == "iETH") {
        if (!etherLoanTokenLogic) {
          console.log(" Deploying EtherLoanTokenLogic.");
          /*etherLoanTokenLogic = await deployer.deploy(
            EtherLoanTokenLogic
          );*/
          etherLoanTokenLogic = await EtherLoanTokenLogic.at("0x6bb082db72be6292291c26956f58e3c988a3e986");
        }
        logicContract = etherLoanTokenLogic;
      } else {
        if (!loanTokenLogic) {
          console.log(" Deploying LoanTokenLogic.");
          /*loanTokenLogic = await deployer.deploy(
            LoanTokenLogic
          );*/
          loanTokenLogic = await LoanTokenLogic.at("0x47108548ccf9f9d06d20bb34af8deca5d4ad2ab6");
        }
        logicContract = loanTokenLogic;
      }

      console.log(" Deploying LoanToken.");
      let loanTokenProxy = await deployer.deploy(
        LoanToken,
        logicContract.address
      );
      let loanToken = await EtherLoanTokenLogic.at(loanTokenProxy.address);
      console.log(" Initialize.");
      await loanToken.initialize(
        BZxProxy.address,
        BZxVault.address,
        BZxOracle.address,
        loanTokenAddress,
        tokenized_registry_address,
        name,
        symbol
      );

      console.log(" toggleProtocolDelegateApproved.");
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: BZxProxy.address,
        data: "0x5c5eb47b" + Web3Utils.padLeft(loanToken.address.toLowerCase().substr(2), 64) + Web3Utils.padLeft("1", 64) // toggleProtocolDelegateApproved(address,bool)
      })

      for (let leverageAmount=1; leverageAmount <= 4; leverageAmount++) {
          let initialMarginAmount, maintenanceMarginAmount;
          if (leverageAmount == 1) {
            initialMarginAmount = web3.utils.toWei("100", "ether");
            maintenanceMarginAmount = web3.utils.toWei("15", "ether");
          } else if (leverageAmount == 2) {
            initialMarginAmount = web3.utils.toWei("50", "ether");
            maintenanceMarginAmount = web3.utils.toWei("15", "ether");
          } else if (leverageAmount == 3) {
            initialMarginAmount = web3.utils.toWei("33.333333333333333333", "ether");
            maintenanceMarginAmount = web3.utils.toWei("15", "ether");
          } else if (leverageAmount == 4) {
            initialMarginAmount = web3.utils.toWei("25", "ether");
            maintenanceMarginAmount = web3.utils.toWei("15", "ether");
          } else {
            console.log("Leverage unsupported!");
            process.exit();
          }                
        
        console.log(" initLeverage "+leverageAmount.toString());
        await loanToken.initLeverage(
          [
            web3.utils.toWei(leverageAmount.toString(), "ether"),
            initialMarginAmount,
            maintenanceMarginAmount,
            "2419200" // 28 days
          ]
        );
      }

      await fs.appendFile("TokenizedLoans_"+network+".log", "LoanToken\t"+loanToken.address+"\t"+loanTokenAddress+"\t"+name+"\t"+symbol+"\n");

      if (network == "development" && symbol == "iETH") {
        console.log(" mintWithEther.");
        await loanToken.mintWithEther(accounts[0], {value: web3.utils.toWei("10", "ether")});
      }

      return loanToken;
    }

    async function deployPToken(
      leverageAmount,
      assetSymbol,
      type,
      baseTokenAddress,
      unitOfAccountTokenAddress,
      unitOfAccountToken,
      loanTokenDeployed
    ) 
    {
      // 100/15, 50/15, 33.333333333333333333/15, 25/15
      let prefix, name, symbol;

      if (unitOfAccountToken == "DAI") {
        prefix = "d";
      } else if (unitOfAccountToken == "USDC") {
        prefix = "u";
      } else {
        console.log("Invalid unit of account!");
        return;
      }

      if (type == "long") {
        if (leverageAmount == 1) {
          return;
        } else {
          name = "bZx Perpetual Long "+assetSymbol+" "+leverageAmount+"x";
          symbol = prefix+"L"+assetSymbol+leverageAmount+"x";
        }
      } else { // type == "short"
        if (leverageAmount == 1) {
          name = "bZx Perpetual Short "+assetSymbol;
          symbol = prefix+"s"+assetSymbol;
        } else {
          name = "bZx Perpetual Short "+assetSymbol+" "+leverageAmount+"x";
          symbol = prefix+"s"+assetSymbol+leverageAmount+"x";
        }
      }

      console.log("Deploying "+name+" ("+unitOfAccountToken+").");
      let leverageAmountWei = web3.utils.toWei(leverageAmount.toString(), "ether");
      let loanOrderHash = await loanTokenDeployed.loanOrderHashes.call(leverageAmountWei);
      if (!positionTokenLogic) {
        console.log(" Deploying PositionTokenLogic.");
        /*positionTokenLogic = await deployer.deploy(
          PositionTokenLogic
        );*/
        positionTokenLogic = await PositionTokenLogic.at("0x6f692acc7f77a8de59d25e75e535bc82a21c18f1");
      }
      console.log(" Deploying PositionToken.");
      let positionToken;
      //if (name == "bZx Perpetual Long KNC 2x") {
      //  positionToken = await PositionTokenLogic.at("0x5c24f19f91f4ea8a3f95cb21ebbea053446d8632");
      //} else {
        let positionTokenProxy = await deployer.deploy(
          PositionToken,
          positionTokenLogic.address
        );
        positionToken = await PositionTokenLogic.at(positionTokenProxy.address);
      //}
      console.log(" Initialize.");
      await positionToken.initialize(
        BZxProxy.address,
        BZxVault.address,
        BZxOracle.address,
        weth_token_address,
        type == "short" ? baseTokenAddress : unitOfAccountTokenAddress, // loan token
        type == "short" ? unitOfAccountTokenAddress : baseTokenAddress, // trade token
        loanTokenDeployed.address,
        leverageAmountWei,
        loanOrderHash,
        name,
        symbol
      );
    
      await fs.appendFile("TokenizedLoans_"+network+".log", "PositionToken\t"+positionToken.address+"\t"
        + (type == "short" ? unitOfAccountTokenAddress : baseTokenAddress)
        + "\t"+name+"\t"+symbol+"\n");

      return positionToken;
    }

    console.log(`   > [${parseInt(path.basename(__filename))}] TokenizedLoans deploy: #done`);
  });
};

