import { constants as constantsZX } from "0x.js/lib/src/utils/constants";
import b0xJS from "../../core/__tests__/setup";
import Accounts from "../../core/__tests__/accounts";
import * as FillTestUtils from "../../fill/__tests__/utils";
import makeOrder from "../../core/__tests__/order";
import * as orderConstants from "../../core/constants/order";
import B0xJS from "../../core";

const { web3 } = b0xJS;

describe("loan positions", () => {
  const owner = Accounts[0].address;
  const lenders = [Accounts[5].address, Accounts[7].address];
  const traders = [Accounts[6].address, Accounts[8].address];

  beforeAll(async () => {
    const {
      loanTokens,
      collateralTokens,
      interestTokens,
      b0xToken
    } = await FillTestUtils.initAllContractInstances();
    const ownerTxOpts = { from: owner };
    const transferAmt = web3.utils.toWei("1000000", "ether");

    await FillTestUtils.setupB0xToken({
      b0xToken,
      lenders,
      traders,
      transferAmt,
      ownerTxOpts
    });
    await FillTestUtils.setupLoanTokens({
      loanTokens,
      lenders,
      transferAmt,
      ownerTxOpts
    });
    await FillTestUtils.setupCollateralTokens({
      collateralTokens,
      traders,
      transferAmt,
      ownerTxOpts
    });
    await FillTestUtils.setupInterestTokens({
      interestTokens,
      traders,
      transferAmt,
      ownerTxOpts
    });

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
      loanTokenAmount: web3.utils.toWei("251").toString(),
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
    await b0xJS.takeLoanOrderAsTrader(
      { ...order, signature },
      collateralTokens[0].options.address.toLowerCase(),
      loanTokenAmountFilled,
      txOpts
    );
  });

  describe("getLoanPositions", async () => {
    /* NOTE: If you want to re-run this test, you must restart
     the local testnet as the orders made by this address will
      accumulate causing this test to fail */
    test("should return loan positions", async () => {
      const loanPositions = await b0xJS.getLoanPositions({
        loanPartyAddress: traders[0],
        start: 0,
        count: 10
      });

      /*
      One thing to keep in mind with tests against takeLoanOrderAsLender or takeLoanOrderAsTrader..
      to calcuate the amount of collateral token amount required and transfered, b0x does a call to the oracle to get the current exchange rate 
      (between collateralToken and loanToken), then based on that and the initialMarginAmount, 
      it calculates and transfers enough collateral token from the trader to satisfy margin requirements. 
      Since the testnet isn't connected to Kyber to get true token rates, the oracle just randomly generates a bogus rate. 
      */
      const loanPositionsNoRandomFields = loanPositions.map(
        ({ loanStartUnixTimestampSec, collateralTokenAmountFilled, ...rest }) =>
          rest
      );

      expect(loanPositionsNoRandomFields).toContainEqual({
        active: 1,
        collateralTokenAddressFilled:
          "0xf96b018e8de3a229dbaced8439df9e3034e263c1",
        lender: "0xa8dda8d7f5310e4a9e24f8eba77e091ac264f872",
        loanTokenAmountFilled: 12300000000000000000,
        positionTokenAddressFilled:
          "0x8a063452f7df2614db1bca3a85ef35da40cf0835",
        positionTokenAmountFilled: 12300000000000000000,
        trader: "0x06cef8e666768cc40cc78cf93d9611019ddcb628"
      });
    });
  });
});
