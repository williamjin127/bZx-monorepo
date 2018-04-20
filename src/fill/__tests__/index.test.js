import { pathOr } from "ramda";
import { constants as constantsZX } from "0x.js/lib/src/utils/constants";
import B0xJS from "../../core";
import b0xJS from "../../core/__tests__/setup";
import makeOrder from "../../core/__tests__/order";
import * as orderConstants from "../../core/constants/order";
import * as Utils from "./utils";
import Accounts from "../../core/__tests__/accounts";
import { expectPromiEvent } from "../../core/__tests__/utils";

const { web3 } = b0xJS;
// Valid sig length, but last digit has been changed
const BAD_SIG =
  "0x056184af8d9bbf1734ddbff840e8be410193a99acab9add00512808250cb40f6423e669f24e65a8ee8af97e1a2abd90644177b39985438ecfee0dd2e7e44f77709";

describe("filling orders", () => {
  const owner = Accounts[0].address;
  const lenders = [Accounts[1].address, Accounts[3].address];
  const traders = [Accounts[2].address, Accounts[4].address];
  const loanTokenAmount = web3.utils.toWei("251").toString();

  beforeAll(async () => {
    const {
      loanTokens,
      collateralTokens,
      interestTokens,
      b0xToken
    } = await Utils.initAllContractInstances();
    const ownerTxOpts = { from: owner };
    const transferAmt = web3.utils.toWei("1000000", "ether");

    const balancePs = [
      b0xToken,
      ...loanTokens,
      ...collateralTokens,
      ...interestTokens
    ].map(token =>
      b0xJS.getBalance({
        tokenAddress: token.options.address.toLowerCase(),
        ownerAddress: owner
      })
    );

    const balancesBefore = await Promise.all(balancePs);
    console.log("before setting up tokens");
    console.log(balancesBefore.map(bigNum => bigNum.toString()));

    await Utils.setupB0xToken({
      b0xToken,
      lenders,
      traders,
      transferAmt,
      ownerTxOpts
    });
    await Utils.setupLoanTokens({
      loanTokens,
      lenders,
      transferAmt,
      ownerTxOpts
    });
    await Utils.setupCollateralTokens({
      collateralTokens,
      traders,
      transferAmt,
      ownerTxOpts
    });
    await Utils.setupInterestTokens({
      interestTokens,
      traders,
      transferAmt,
      ownerTxOpts
    });

    const balancePs2 = [
      b0xToken,
      ...loanTokens,
      ...collateralTokens,
      ...interestTokens
    ].map(token =>
      b0xJS.getBalance({
        tokenAddress: token.options.address.toLowerCase(),
        ownerAddress: owner
      })
    );

    console.log("after setting up tokens");
    const balancesAfter = await Promise.all(balancePs2);
    console.log(balancesAfter.map(bigNum => bigNum.toString()));
  });

  describe("takeLoanOrderAsLender", async () => {
    test("should throw an error with an invalid signature", async () => {
      const {
        loanTokens,
        interestTokens,
        collateralTokens
      } = await Utils.initAllContractInstances();
      const makerAddress = traders[1];
      const takerAddress = lenders[1];
      const txOpts = {
        from: takerAddress,
        gas: 1000000,
        gasPrice: web3.utils.toWei("30", "gwei").toString()
      };
      const expirationUnixTimestampSec = "1719061340";

      const order = makeOrder({
        makerAddress,
        loanTokenAddress: loanTokens[1].options.address.toLowerCase(),
        interestTokenAddress: interestTokens[1].options.address.toLowerCase(),
        collateralTokenAddress: collateralTokens[1].options.address.toLowerCase(),
        feeRecipientAddress: constantsZX.NULL_ADDRESS,
        loanTokenAmount,
        interestAmount: web3.utils.toWei("2").toString(),
        initialMarginAmount: "50",
        maintenanceMarginAmount: "25",
        lenderRelayFee: web3.utils.toWei("0.001").toString(),
        traderRelayFee: web3.utils.toWei("0.0015").toString(),
        expirationUnixTimestampSec,
        makerRole: orderConstants.MAKER_ROLE.TRADER,
        salt: B0xJS.generatePseudoRandomSalt().toString()
      });

      expect(() => {
        b0xJS.takeLoanOrderAsLender({ ...order, signature: BAD_SIG }, txOpts);
      }).toThrow();
      expect(() => {
        b0xJS.takeLoanOrderAsLender({ ...order, signature: BAD_SIG }, txOpts);
      }).toThrowErrorMatchingSnapshot();
    });

    test("should return total amount of loanToken borrowed", async () => {
      const {
        loanTokens,
        interestTokens,
        collateralTokens
      } = await Utils.initAllContractInstances();
      const makerAddress = traders[1];
      const takerAddress = lenders[1];
      const txOpts = {
        from: takerAddress,
        gas: 1000000,
        gasPrice: web3.utils.toWei("30", "gwei").toString()
      };
      const expirationUnixTimestampSec = "1719061340";

      const order = makeOrder({
        makerAddress,
        loanTokenAddress: loanTokens[1].options.address.toLowerCase(),
        interestTokenAddress: interestTokens[1].options.address.toLowerCase(),
        collateralTokenAddress: collateralTokens[1].options.address.toLowerCase(),
        feeRecipientAddress: constantsZX.NULL_ADDRESS,
        loanTokenAmount,
        interestAmount: web3.utils.toWei("2").toString(),
        initialMarginAmount: "50",
        maintenanceMarginAmount: "25",
        lenderRelayFee: web3.utils.toWei("0.001").toString(),
        traderRelayFee: web3.utils.toWei("0.0015").toString(),
        expirationUnixTimestampSec,
        makerRole: orderConstants.MAKER_ROLE.TRADER,
        salt: B0xJS.generatePseudoRandomSalt().toString()
      });

      const orderHashHex = B0xJS.getLoanOrderHashHex(order);
      const signature = await b0xJS.signOrderHashAsync(
        orderHashHex,
        makerAddress
      );

      const receipt = await b0xJS.takeLoanOrderAsLender(
        { ...order, signature },
        txOpts
      );

      const loanTokenAmountFilledReturn = pathOr(
        null,
        ["events", "LogLoanTaken", "returnValues", "loanTokenAmountFilled"],
        receipt
      );

      expect(loanTokenAmountFilledReturn).toBe(loanTokenAmount);
    });

    test("should return a web3 PromiEvent", async () => {
      const {
        loanTokens,
        interestTokens,
        collateralTokens
      } = await Utils.initAllContractInstances();
      const makerAddress = traders[1];
      const takerAddress = lenders[1];
      const txOpts = {
        from: takerAddress,
        gas: 1000000,
        gasPrice: web3.utils.toWei("30", "gwei").toString()
      };
      const expirationUnixTimestampSec = "1719061340";

      const order = makeOrder({
        makerAddress,
        loanTokenAddress: loanTokens[1].options.address.toLowerCase(),
        interestTokenAddress: interestTokens[1].options.address.toLowerCase(),
        collateralTokenAddress: collateralTokens[1].options.address.toLowerCase(),
        feeRecipientAddress: constantsZX.NULL_ADDRESS,
        loanTokenAmount,
        interestAmount: web3.utils.toWei("2").toString(),
        initialMarginAmount: "50",
        maintenanceMarginAmount: "25",
        lenderRelayFee: web3.utils.toWei("0.001").toString(),
        traderRelayFee: web3.utils.toWei("0.0015").toString(),
        expirationUnixTimestampSec,
        makerRole: orderConstants.MAKER_ROLE.TRADER,
        salt: B0xJS.generatePseudoRandomSalt().toString()
      });

      const orderHashHex = B0xJS.getLoanOrderHashHex(order);
      const signature = await b0xJS.signOrderHashAsync(
        orderHashHex,
        makerAddress
      );

      const promiEvent = b0xJS.takeLoanOrderAsLender(
        { ...order, signature },
        txOpts
      );
      expectPromiEvent(promiEvent);
    });
  });

  describe("takeLoanOrderAsTrader", async () => {
    test("should throw an error with an invalid signature", async () => {
      const {
        loanTokens,
        interestTokens
      } = await Utils.initAllContractInstances();
      const makerAddress = lenders[0];
      const takerAddress = traders[0];
      const txOpts = {
        from: takerAddress,
        gas: 1000000,
        gasPrice: web3.utils.toWei("30", "gwei").toString()
      };
      const expirationUnixTimestampSec = "1719061340";

      const order = makeOrder({
        makerAddress,
        loanTokenAddress: loanTokens[0].options.address.toLowerCase(),
        interestTokenAddress: interestTokens[0].options.address.toLowerCase(),
        collateralTokenAddress: constantsZX.NULL_ADDRESS,
        feeRecipientAddress: constantsZX.NULL_ADDRESS,
        loanTokenAmount,
        interestAmount: web3.utils.toWei("2").toString(),
        initialMarginAmount: "50",
        maintenanceMarginAmount: "25",
        lenderRelayFee: web3.utils.toWei("0.001").toString(),
        traderRelayFee: web3.utils.toWei("0.0015").toString(),
        expirationUnixTimestampSec,
        makerRole: orderConstants.MAKER_ROLE.LENDER,
        salt: B0xJS.generatePseudoRandomSalt().toString()
      });

      expect(() => {
        b0xJS.takeLoanOrderAsTrader({ ...order, signature: BAD_SIG }, txOpts);
      }).toThrow();
      expect(() => {
        b0xJS.takeLoanOrderAsTrader({ ...order, signature: BAD_SIG }, txOpts);
      }).toThrowErrorMatchingSnapshot();
    });

    test("should return total amount of loanToken borrowed", async () => {
      const {
        loanTokens,
        interestTokens,
        collateralTokens
      } = await Utils.initAllContractInstances();
      const makerAddress = lenders[0];
      const takerAddress = traders[0];
      const txOpts = {
        from: takerAddress,
        gas: 1000000,
        gasPrice: web3.utils.toWei("30", "gwei").toString()
      };
      const expirationUnixTimestampSec = "1719061340";

      const order = makeOrder({
        makerAddress,
        loanTokenAddress: loanTokens[0].options.address.toLowerCase(),
        interestTokenAddress: interestTokens[0].options.address.toLowerCase(),
        collateralTokenAddress: constantsZX.NULL_ADDRESS,
        feeRecipientAddress: constantsZX.NULL_ADDRESS,
        loanTokenAmount,
        interestAmount: web3.utils.toWei("2").toString(),
        initialMarginAmount: "50",
        maintenanceMarginAmount: "25",
        lenderRelayFee: web3.utils.toWei("0.001").toString(),
        traderRelayFee: web3.utils.toWei("0.0015").toString(),
        expirationUnixTimestampSec,
        makerRole: orderConstants.MAKER_ROLE.LENDER,
        salt: B0xJS.generatePseudoRandomSalt().toString()
      });

      const orderHashHex = B0xJS.getLoanOrderHashHex(order);
      const signature = await b0xJS.signOrderHashAsync(
        orderHashHex,
        makerAddress
      );

      const loanTokenAmountFilled = web3.utils.toWei("12.3");
      const receipt = await b0xJS.takeLoanOrderAsTrader(
        { ...order, signature },
        collateralTokens[0].options.address.toLowerCase(),
        loanTokenAmountFilled,
        txOpts
      );
      const loanTokenAmountFilledReturn = pathOr(
        null,
        ["events", "LogLoanTaken", "returnValues", "loanTokenAmountFilled"],
        receipt
      );
      expect(loanTokenAmountFilledReturn).toBe(loanTokenAmountFilled);
    });

    test("should return a web3 PromiEvent", async () => {
      const {
        loanTokens,
        interestTokens,
        collateralTokens
      } = await Utils.initAllContractInstances();
      const makerAddress = lenders[0];
      const takerAddress = traders[0];
      const txOpts = {
        from: takerAddress,
        gas: 1000000,
        gasPrice: web3.utils.toWei("30", "gwei").toString()
      };
      const expirationUnixTimestampSec = "1719061340";

      const order = makeOrder({
        makerAddress,
        loanTokenAddress: loanTokens[0].options.address.toLowerCase(),
        interestTokenAddress: interestTokens[0].options.address.toLowerCase(),
        collateralTokenAddress: constantsZX.NULL_ADDRESS,
        feeRecipientAddress: constantsZX.NULL_ADDRESS,
        loanTokenAmount,
        interestAmount: web3.utils.toWei("2").toString(),
        initialMarginAmount: "50",
        maintenanceMarginAmount: "25",
        lenderRelayFee: web3.utils.toWei("0.001").toString(),
        traderRelayFee: web3.utils.toWei("0.0015").toString(),
        expirationUnixTimestampSec,
        makerRole: orderConstants.MAKER_ROLE.LENDER,
        salt: B0xJS.generatePseudoRandomSalt().toString()
      });

      const orderHashHex = B0xJS.getLoanOrderHashHex(order);
      const signature = await b0xJS.signOrderHashAsync(
        orderHashHex,
        makerAddress
      );

      const loanTokenAmountFilled = web3.utils.toWei("12.3");
      const promiEvent = b0xJS.takeLoanOrderAsTrader(
        { ...order, signature },
        collateralTokens[0].options.address.toLowerCase(),
        loanTokenAmountFilled,
        txOpts
      );
      expectPromiEvent(promiEvent);
    });
  });
});
