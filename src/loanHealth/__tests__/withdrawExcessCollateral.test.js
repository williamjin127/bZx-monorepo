import { pathOr } from "ramda";
// import BigNumber from "bignumber.js";
import B0xJS from "../../core";
import b0xJS from "../../core/__tests__/setup";
import { expectPromiEvent } from "../../core/__tests__/utils";
import * as FillTestUtils from "../../fill/__tests__/utils";

const { web3 } = b0xJS;

describe("loanHeath", () => {
  describe("withdrawExcessCollateral", () => {
    const { owner, lenders, traders } = FillTestUtils.getAccounts();
    const {
      loanTokens,
      interestTokens,
      collateralTokens
    } = FillTestUtils.initAllContractInstances();

    let promiEvent = null;
    let loanOrderHash = null;
    // let loansBefore = null;

    const collateralTokenFilled = collateralTokens[0].options.address.toLowerCase();
    const depositAmount = web3.utils.toWei("2").toString();
    const withdrawAmount = web3.utils.toWei("2").toString();

    let order = null;

    beforeAll(async () => {
      await FillTestUtils.setupAll({
        owner,
        lenders,
        traders,
        transferAmount: web3.utils.toWei("100", "ether")
      });

      order = FillTestUtils.makeOrderAsLender({
        web3,
        lenders,
        loanTokens,
        interestTokens
      });
      loanOrderHash = B0xJS.getLoanOrderHashHex(order);

      const signature = await b0xJS.signOrderHashAsync(
        loanOrderHash,
        order.makerAddress
      );
      const txOpts = {
        from: traders[0],
        gas: 1000000,
        gasPrice: web3.utils.toWei("30", "gwei").toString()
      };
      const loanTokenAmountFilled = web3.utils.toWei("12.3");
      // b0x hash that we give to tradePositionWith0x must belong to a loan that was previously filled, so we fill the loan order here
      const takeLoanOrderAsTraderReceipt = await b0xJS.takeLoanOrderAsTrader(
        { ...order, signature },
        collateralTokenFilled,
        loanTokenAmountFilled,
        txOpts
      );

      expect(
        pathOr(null, ["events", "DebugLine"], takeLoanOrderAsTraderReceipt)
      ).toEqual(null);

      //   loansBefore = await b0xJS.getLoansForTrader({
      //     address: traders[0],
      //     start: 0,
      //     count: 10
      //   });

      await b0xJS.depositCollateral({
        loanOrderHash,
        collateralTokenFilled,
        depositAmount,
        txOpts
      });

      promiEvent = b0xJS.withdrawExcessCollateral({
        loanOrderHash,
        collateralTokenFilled,
        withdrawAmount,
        txOpts
      });
    });

    test("should return promiEvent", () => {
      expectPromiEvent(promiEvent);
    });

    test("should withdraw collateral successfully", async () => {
      const receipt = await promiEvent;
      expect(pathOr(null, ["events", "DebugLine"], receipt)).toEqual(null);
    });
  });
});
