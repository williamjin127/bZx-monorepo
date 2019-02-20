const BZx = artifacts.require("BZx");
const BZxProxy = artifacts.require("BZxProxy");
const BZxVault = artifacts.require("BZxVault");
const BZxOracle = artifacts.require("TestNetOracle");
const ERC20 = artifacts.require("ERC20");

const BZxTo0xV2 = artifacts.require("BZxTo0xV2");
const Exchange0xV2 = artifacts.require("ExchangeV2InterfaceWithEvents");
const ZeroExV2Helper = artifacts.require("ZeroExV2Helper");

const BN = require("bn.js");
const eventsHelper = require("./utils/eventsHelper");

import {
    assetDataUtils,
    signatureUtils,
    generatePseudoRandomSalt,
    orderHashUtils
} from "@0xproject/order-utils";

var config = require("../protocol-config.js");

const Reverter = require("./utils/reverter");
const utils = require("./utils/utils.js");

const MAX_UINT = (new BN(2)).pow(new BN(256)).sub(new BN(1));

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

const SignatureType = Object.freeze({
    Illegal: 0,
    Invalid: 1,
    EIP712: 2,
    EthSign: 3,
    Wallet: 4,
    Validator: 5,
    PreSigned: 6
});

contract("BZxTest: order taking", function(accounts) {
    let reverter = new Reverter(web3);
    var bZx;
    var vault;
    var oracle;
    var bZxTo0xV2;

    var test_tokens = [];

    var zrx_token;
    var exchange_0xV2;
    var zeroExV2Helper;

    // account roles
    var owner = accounts[0]; // owner/contract creator, holder of all tokens
    var lender1 = accounts[1]; // lender 1
    var trader1 = accounts[2]; // trader 1
    var lender2 = accounts[3]; // lender 2
    var trader2 = accounts[4]; // trader 2
    var maker1 = accounts[7]; // maker of 0x order
    var maker2 = accounts[8]; // maker of 0x order

    var loanToken1;
    var loanToken2;
    var collateralToken1;
    var collateralToken2;
    var interestToken1;
    var interestToken2;
    var maker0xV2Token1;

    var stranger = accounts[6];
    var strangerLender = accounts[5];
    var strangerTrader = accounts[9];

    before("Init: retrieve all deployed contracts", async () => {
        vault = await BZxVault.deployed();
        bZxTo0xV2 = await BZxTo0xV2.deployed();
        oracle = await BZxOracle.deployed();
        bZx = await BZx.at((await BZxProxy.deployed()).address);
        exchange_0xV2 = await Exchange0xV2.at(config["addresses"]["development"]["ZeroEx"]["ExchangeV2"]);
        zeroExV2Helper = await ZeroExV2Helper.deployed();
        zrx_token = await ERC20.at(config["addresses"]["development"]["ZeroEx"]["ZRXToken"]);
    });

    before("Init: retrieve all deployed test tokens and handle token transfers and approvals", async () => {
        for (var i = 0; i < 10; i++) {
            test_tokens[i] = await artifacts.require("TestToken" + i).deployed();
        }

        loanToken1 = test_tokens[0];
        loanToken2 = test_tokens[1];
        collateralToken1 = test_tokens[2];
        collateralToken2 = test_tokens[3];
        interestToken1 = test_tokens[4];
        interestToken2 = test_tokens[5];
        maker0xV2Token1 = test_tokens[7];

        await loanToken1.transfer(lender1, utils.toWei(1000000, "ether"));
        await loanToken2.transfer(lender2, utils.toWei(1000000, "ether"));
        await loanToken1.approve(vault.address, MAX_UINT, { from: lender1 });
        await loanToken2.approve(vault.address, MAX_UINT, { from: lender2 });
        await collateralToken1.transfer(trader1, utils.toWei(1000000, "ether"));
        await collateralToken1.transfer(trader2, utils.toWei(1000000, "ether"));
        await collateralToken2.transfer(trader1, utils.toWei(1000000, "ether"));
        await collateralToken2.transfer(trader2, utils.toWei(1000000, "ether"));
        await collateralToken1.approve(vault.address, MAX_UINT, {from: trader1});
        await collateralToken1.approve(vault.address, MAX_UINT, {from: trader2});
        await collateralToken2.approve(vault.address, MAX_UINT, {from: trader1});
        await collateralToken2.approve(vault.address, MAX_UINT, {from: trader2});
        await interestToken1.transfer(trader1, utils.toWei(1000000, "ether"));
        await interestToken1.transfer(trader2, utils.toWei(1000000, "ether"));
        await interestToken2.transfer(trader1, utils.toWei(1000000, "ether"));
        await interestToken2.transfer(trader2, utils.toWei(1000000, "ether"));
        await interestToken1.transfer(strangerTrader, utils.toWei(1000000, "ether"));
        await interestToken1.transfer(strangerLender, utils.toWei(1000000, "ether"));
        await interestToken1.approve(vault.address, MAX_UINT, { from: trader1 });
        await interestToken1.approve(vault.address, MAX_UINT, { from: trader2 });
        await interestToken1.approve(vault.address, MAX_UINT, { from: strangerTrader });
        await interestToken1.approve(vault.address, MAX_UINT, { from: strangerLender});
        await interestToken2.approve(vault.address, MAX_UINT, { from: trader1 });
        await interestToken2.approve(vault.address, MAX_UINT, { from: trader2 });
        await maker0xV2Token1.transfer(maker1, utils.toWei(10000, "ether"));
        await maker0xV2Token1.transfer(maker2, utils.toWei(10000, "ether"));
        await maker0xV2Token1.approve(config["addresses"]["development"]["ZeroEx"]["ERC20Proxy"],MAX_UINT,{ from: maker1 });
        await maker0xV2Token1.approve(config["addresses"]["development"]["ZeroEx"]["ERC20Proxy"],MAX_UINT,{ from: maker2 });
        await zrx_token.transfer(trader1, utils.toWei(10000, "ether"));
        await zrx_token.transfer(trader2, utils.toWei(10000, "ether"));
        await zrx_token.approve(bZxTo0xV2.address, MAX_UINT, { from: trader1 });
        await zrx_token.approve(bZxTo0xV2.address, MAX_UINT, { from: trader2 });
        await zrx_token.transfer(maker1, utils.toWei(10000, "ether"));
        await zrx_token.transfer(maker2, utils.toWei(10000, "ether"));
        await zrx_token.approve(config["addresses"]["development"]["ZeroEx"]["TokenTransferProxy"],MAX_UINT,{ from: maker1 });
        await zrx_token.approve(config["addresses"]["development"]["ZeroEx"]["TokenTransferProxy"],MAX_UINT,{ from: maker2 });
        await zrx_token.approve(config["addresses"]["development"]["ZeroEx"]["ERC20Proxy"],MAX_UINT,{ from: maker1 });
        await zrx_token.approve(config["addresses"]["development"]["ZeroEx"]["ERC20Proxy"],MAX_UINT,{ from: maker2 });

        assert.isTrue((await loanToken1.balanceOf.call(lender1)).eq(utils.toWei(1000000, "ether")));
        assert.isTrue((await collateralToken1.balanceOf.call(trader1)).eq(utils.toWei(1000000, "ether")));
        assert.isTrue((await interestToken1.balanceOf.call(trader1)).eq(utils.toWei(1000000, "ether")));

        assert.isTrue((await loanToken1.allowance.call(lender1, vault.address)).eq(MAX_UINT));
        assert.isTrue((await collateralToken1.allowance.call(trader1, vault.address)).eq(MAX_UINT));
        assert.isTrue((await interestToken1.allowance.call(trader1, vault.address)).eq(MAX_UINT));
    });

    context("Off-chain loans: `trader` loan taking tests", async () => {
        let order;
        let orderHash;
        let loanTokenFilled = utils.toWei(12.3, "ether");

        before("before", async () => {
            await reverter.snapshot();
        });

        before("init off-chain `trader` loan", async () => {
            order = await generateTraderOrder();

            orderHash = await bZx.getLoanOrderHash.call(
                orderAddresses(order),
                orderValues(order),
        		"0x00" // oracleData
            );

            let signature = await sign(lender1, orderHash);

            await bZx.takeLoanOrderAsTrader(
                orderAddresses(order),
                orderValues(order),
                "0x00", // oracleData
                collateralToken1.address,
                loanTokenFilled,
                NULL_ADDRESS,
                false,
                signature,
                {from: trader1}
            );
        })

        it("should allow to cancel `trader` off-chain order loan", async () => {
            let cancelledLoanTokenAmount = await bZx.cancelLoanOrderWithHash.call(
                orderHash,
                MAX_UINT,
                {from: lender1})

            let tx = await bZx.cancelLoanOrderWithHash(
                orderHash,
                MAX_UINT,
                {from: lender1}
            )

            let event = eventsHelper.extractEvents(tx, "LogLoanCancelled")[0];
            assert.isTrue(cancelledLoanTokenAmount.eq(event.args.cancelLoanTokenAmount));
            assert.isTrue(event.args.remainingLoanTokenAmount.isZero());
            //assert.isTrue(event.args.cancelLoanTokenAmount.add(loanTokenFilled).eq(order.loanTokenAmount));
        })

        after("clean up", async () => {
            await reverter.revert();
        });
    });

    context("Off-chain loans: `lender` loan taking tests", async () => {
        let order;
        let orderHash;

        before("before", async () => {
            await reverter.snapshot();
        });

        before("init off-chain `lender` loan", async () => {
            order = await generateLenderOrder();

            orderHash = await bZx.getLoanOrderHash.call(
                orderAddresses(order),
                orderValues(order),
        		"0x00" // oracleData
            );

            let signature = await sign(trader2, orderHash);

            await bZx.takeLoanOrderAsLender(
                orderAddresses(order),
                orderValues(order),
                "0x00", // oracleData
                signature,
                {from: lender2}
            );
        })

        it("there should be the full amount to cancel", async () => {
            let cancelledLoanTokenAmount = await bZx.cancelLoanOrderWithHash.call(
                orderHash,
                MAX_UINT,
                {from: trader2}
            )
            
            assert.isTrue(cancelledLoanTokenAmount.eq(order.loanTokenAmount));
        })

        after("clean up", async () => {
            await reverter.revert();
        });
    });

    context("On-chain loans: `trader` loan taking tests", async () => {
        let order;
        let orderHash;
        let loanTokenFilled = utils.toWei(20, "ether");

        before("before", async () => {
            await reverter.snapshot();
        });

        before("init 'trader' on-chain loan", async () => {
            order = await generateTraderOrder();

            orderHash = await bZx.getLoanOrderHash.call(
                orderAddresses(order),
                orderValues(order),
        		"0x00" // oracleData
            );

            let signature = await sign(lender1, orderHash);

            await bZx.pushLoanOrderOnChain(
                orderAddresses(order),
                orderValues(order),
                "0x00", // oracleData
                signature,
                {from: maker2}
            );

            await bZx.takeLoanOrderOnChainAsTrader(
                orderHash,
                collateralToken1.address,
                loanTokenFilled,
                NULL_ADDRESS,
                false,
                {from: trader2}
            );
        });

        it("should allow to cancel 'trader' on-chain order loan", async () => {
            let cancelledLoanTokenAmount = await bZx.cancelLoanOrderWithHash.call(
                orderHash,
                MAX_UINT,
                {from: lender1})

            let tx = await bZx.cancelLoanOrderWithHash(
                orderHash,
                MAX_UINT,
                {from: lender1}
            )

            let event = eventsHelper.extractEvents(tx, "LogLoanCancelled")[0];
            assert.isTrue(cancelledLoanTokenAmount.eq(event.args.cancelLoanTokenAmount));
            assert.isTrue(event.args.remainingLoanTokenAmount.isZero());
            //assert.isTrue(event.args.cancelLoanTokenAmount.add(loanTokenFilled).eq(order.loanTokenAmount));
        })

        after("clean up", async () => {
            await reverter.revert();
        });
    });

    context("On-chain loans: `lender` loan taking tests", async () => {
        let order;
        let orderHash;

        before("before", async () => {
            await reverter.snapshot();
        });

        before("init `lender` on-chain loan", async () => {
            order = await generateLenderOrder();

            orderHash = await bZx.getLoanOrderHash.call(
                orderAddresses(order),
                orderValues(order),
        		"0x00" // oracleData
            );

            let signature = await sign(trader2, orderHash);

            await bZx.pushLoanOrderOnChain(
                orderAddresses(order),
                orderValues(order),
                "0x00", // oracleData
                signature,
                {from: maker1}
            );

            await bZx.takeLoanOrderOnChainAsLender(orderHash, {from: lender2});
        });

        it("there should be the full amount to cancel", async () => {
            let cancelledLoanTokenAmount = await bZx.cancelLoanOrderWithHash.call(
                orderHash,
                MAX_UINT,
                {from: trader2}
            )
            
            assert.isTrue(cancelledLoanTokenAmount.eq(order.loanTokenAmount));
        })

        after("clean up", async () => {
            await reverter.revert();
        });
    });

    context("On-chain loans (with Presign): `trader` loan taking tests", async () => {
        let order;
        let orderHash;
        const loanTokenFilled = utils.toWei(20, "ether");

        before("before", async () => {
            await reverter.snapshot();
        });

        before("init on-chain `trader` loan with presign", async () => {
            order = await generateTraderOrder();

            orderHash = await bZx.getLoanOrderHash.call(
                orderAddresses(order),
                orderValues(order),
        		"0x00", // oracleData
            );

            let signature = "0x"+"00".repeat(65)+"06"; // SignatureType == PreSigned (null-padded to 66 bytes)

            await bZx.preSign(
                order["makerAddress"],
                orderAddresses(order),
                orderValues(order),
                "0x00", // oracleData
                signature,
                {from: order["makerAddress"]}
            );

            await bZx.pushLoanOrderOnChain(
                orderAddresses(order),
                orderValues(order),
                "0x00", // oracleData
                signature,
                {from: maker2}
            );

            await bZx.takeLoanOrderOnChainAsTrader(
                orderHash,
                collateralToken1.address,
                loanTokenFilled,
                NULL_ADDRESS,
                false,
                {from: trader2}
            );
        });

        it("should allow to cancel `trader` on-chain order loan", async () => {
            let cancelledLoanTokenAmount = await bZx.cancelLoanOrderWithHash.call(
                orderHash,
                MAX_UINT,
                {from: order["makerAddress"]})

            let tx = await bZx.cancelLoanOrderWithHash(
                orderHash,
                MAX_UINT,
                {from: order["makerAddress"]}
            )

            let event = eventsHelper.extractEvents(tx, "LogLoanCancelled")[0];
            assert.isTrue(cancelledLoanTokenAmount.eq(event.args.cancelLoanTokenAmount));
            assert.isTrue(event.args.remainingLoanTokenAmount.isZero());
            //assert.isTrue(event.args.cancelLoanTokenAmount.add(loanTokenFilled).eq(order.loanTokenAmount));
        })

        after("clean up", async () => {
            await reverter.revert();
        });
    });

    context("On-chain loans (with Presign): `lender` loan taking tests", async () => {
        let order;
        let orderHash;

        before("before", async () => {
            await reverter.snapshot();
        });

        before("init on-chain `lender` loan with presign", async () => {
            order = await generateLenderOrder();

            orderHash = await bZx.getLoanOrderHash.call(
                orderAddresses(order),
                orderValues(order),
        		"0x00" // oracleData
            );

            let signature = "0x"+"00".repeat(65)+"06"; // SignatureType == PreSigned (null-padded to 66 bytes)

            await bZx.preSignWithHash(
                order["makerAddress"],
                orderHash,
                signature,
                {from: order["makerAddress"]}
            );

            await bZx.pushLoanOrderOnChain(
                orderAddresses(order),
                orderValues(order),
                "0x00", // oracleData
                signature,
                { from: maker1 }
            );

            await bZx.takeLoanOrderOnChainAsLender(orderHash, {from: lender2});
        });

        it("there should be the full amount to cancel", async () => {
            let cancelledLoanTokenAmount = await bZx.cancelLoanOrderWithHash.call(
                orderHash,
                MAX_UINT,
                {from: trader2}
            )
            
            assert.isTrue(cancelledLoanTokenAmount.eq(order.loanTokenAmount));
        })

        after("clean up", async () => {
            await reverter.revert();
        });
    });

    function toHex(d) {
        return ("0" + Number(d).toString(16)).slice(-2).toUpperCase();
    }

    let ordersForUser = async (user) => {
        return decodeOrders(await bZx.getOrdersForUser.call(user, 0, 10, NULL_ADDRESS));
    }

    let countOrdersForUser = async (user) => {
        let orders = await ordersForUser(user);
        return orders ? orders.length : 0;
    }

    function decodeOrders(data) {
        if (!data) {
            return [];
        }

        data = data.substr(2); // remove 0x from front
        const itemCount = 23;
        const objCount = data.length / 64 / itemCount;

        assert.isTrue(objCount % 1 == 0);

        var orderObjArray = data.match(
            new RegExp(".{1," + itemCount * 64 + "}", "g")
        );
        if (!orderObjArray) {
            return [];
        }

        var result = [];

        for (var i = 0; i < orderObjArray.length; i++) {
            var params = orderObjArray[i].match(new RegExp(".{1," + 64 + "}", "g"));
            result.push({
                makerAddress: "0x" + params[0].substr(24),
                loanTokenAddress: "0x" + params[1].substr(24),
                interestTokenAddress: "0x" + params[2].substr(24),
                collateralTokenAddress: "0x" + params[3].substr(24),
                feeRecipientAddress: "0x" + params[4].substr(24),
                oracleAddress: "0x" + params[5].substr(24),
                loanTokenAmount: parseInt("0x" + params[6]),
                interestAmount: parseInt("0x" + params[7]),
                initialMarginAmount: parseInt("0x" + params[8]),
                maintenanceMarginAmount: parseInt("0x" + params[9]),
                lenderRelayFee: parseInt("0x" + params[10]),
                traderRelayFee: parseInt("0x" + params[11]),
                maxDurationUnixTimestampSec: parseInt("0x" + params[12]),
                expirationUnixTimestampSec: parseInt("0x" + params[13]),
                loanOrderHash: "0x" + params[14],
                lender: "0x" + params[15].substr(24),
                orderFilledAmount: parseInt("0x" + params[16]),
                orderCancelledAmount: parseInt("0x" + params[17]),
                orderTraderCount: parseInt("0x" + params[18]),
                addedUnixTimestampSec: parseInt("0x" + params[19]),
                takerAddress: "0x" + params[20].substr(24),
                tradeTokenToFillAddress: "0x" + params[21].substr(24),
                withdrawOnOpen: parseInt("0x" + params[22]) ? true : false
            });
        }

        return result;
    }

    let sign = async (signer, data) => {
        let signature = await web3.eth.sign(data, signer) + toHex(SignatureType.EthSign);

        assert.isOk(await bZx.isValidSignature.call(signer, data, signature));
        return signature;
    };

    let orderAddresses = (order) => {
        return [
            order["makerAddress"],
            order["loanTokenAddress"],
            order["interestTokenAddress"],
            order["collateralTokenAddress"],
            order["feeRecipientAddress"],
            order["oracleAddress"],
            order["takerAddress"],
            order["tradeTokenToFillAddress"]
        ]
    }

    let orderValues = (order) => {
        return [
            new BN(order["loanTokenAmount"]),
            new BN(order["interestAmount"]),
            new BN(order["initialMarginAmount"]),
            new BN(order["maintenanceMarginAmount"]),
            new BN(order["lenderRelayFee"]),
            new BN(order["traderRelayFee"]),
            new BN(order["maxDurationUnixTimestampSec"]),
            new BN(order["expirationUnixTimestampSec"]),
            new BN(order["makerRole"]),
            new BN(order["withdrawOnOpen"]),
            new BN(order["salt"])
        ]
    }

    let generateLenderOrder = async () => {
        let block = await web3.eth.getBlock("latest");

        let lenderOrder = {
            bZxAddress: bZx.address,
            makerAddress: trader2, // lender
            loanTokenAddress: loanToken2.address,
            interestTokenAddress: interestToken2.address,
            collateralTokenAddress: collateralToken2.address,
            feeRecipientAddress: utils.zeroAddress,
            oracleAddress: oracle.address,
            loanTokenAmount: utils.toWei(100000, "ether"),
            interestAmount: utils.toWei(2, "ether").toString(), // 2 token units per day
            initialMarginAmount: utils.toWei(50, "ether").toString(), // 50%
            maintenanceMarginAmount: utils.toWei(25, "ether").toString(), // 25%
            lenderRelayFee: utils.toWei(0.001, "ether").toString(),
            traderRelayFee: utils.toWei(0.0015, "ether").toString(),
            maxDurationUnixTimestampSec: "2419200", // 28 days
            expirationUnixTimestampSec: ((await web3.eth.getBlock("latest")).timestamp + 86400).toString(),
            makerRole: "1", // 0=lender, 1=trader
            salt: generatePseudoRandomSalt().toString(),
            takerAddress: NULL_ADDRESS,
	        tradeTokenToFillAddress: NULL_ADDRESS,
            withdrawOnOpen: "0"
        }

        return lenderOrder;
    }

    let generateTraderOrder = async () => {
        let traderOrder = {
            bZxAddress: bZx.address,
            makerAddress: lender1, // lender
            loanTokenAddress: loanToken1.address,
            interestTokenAddress: interestToken1.address,
            collateralTokenAddress: utils.zeroAddress,
            feeRecipientAddress: utils.zeroAddress,
            oracleAddress: oracle.address,
            loanTokenAmount: utils.toWei(10000, "ether"),
            interestAmount: utils.toWei(2, "ether").toString(), // 2 token units per day
            initialMarginAmount: utils.toWei(50, "ether").toString(), // 50%
            maintenanceMarginAmount: utils.toWei(5, "ether").toString(), // 25%
            lenderRelayFee: utils.toWei(0.001, "ether").toString(),
            traderRelayFee: utils.toWei(0.0015, "ether").toString(),
            maxDurationUnixTimestampSec: "2419200", // 28 days
            expirationUnixTimestampSec: ((await web3.eth.getBlock("latest")).timestamp + 86400).toString(),
            makerRole: "0", // 0=lender, 1=trader
            salt: generatePseudoRandomSalt().toString(),
            takerAddress: NULL_ADDRESS,
		    tradeTokenToFillAddress: NULL_ADDRESS,
            withdrawOnOpen: "0"
        }

        return traderOrder;
    }
});
