import { pathOr, pipe } from "ramda";
import { BZxJS } from "../../core/index";
import bZxJS from "../../core/__tests__/setup";
import * as FillTestUtils from "../../fill/__tests__/utils";
import * as CoreTestUtils from "../../core/__tests__/utils";

describe("trade", () => {
  const { web3 } = bZxJS;
  const {
    loanTokens,
    interestTokens,
    collateralTokens
  } = FillTestUtils.initAllContractInstances();

  const { owner, lenders, traders } = FillTestUtils.getAccounts();

  const takerAddress = traders[0];
  const txOpts = {
    from: takerAddress,
    gas: 1000000,
    gasPrice: web3.utils.toWei("5", "gwei").toString()
  };

  let orderHash = null;
  let promiEvent = null;
  let takeLoanOrderAsTraderReceipt = null;

  beforeAll(async () => {
    await FillTestUtils.setupAll({
      owner,
      lenders,
      traders,
      transferAmount: web3.utils.toWei("1000000", "ether")
    });

    const order = FillTestUtils.makeOrderAsLender({
      web3,
      lenders,
      loanTokens,
      interestTokens
    });
    orderHash = BZxJS.getLoanOrderHashHex(order);

    // bZx hash that we give to tradePositionWith0x must belong to a loan that was previously filled, so we fill the loan order here
    const signature = await bZxJS.signOrderHashAsync(
      orderHash,
      order.makerAddress
    );
    const loanTokenAmountFilled = web3.utils.toWei("12.3");
    takeLoanOrderAsTraderReceipt = await bZxJS.takeLoanOrderAsTrader(
      { ...order, signature },
      collateralTokens[0].options.address.toLowerCase(),
      loanTokenAmountFilled,
      txOpts
    );

    promiEvent = bZxJS.tradePositionWithOracle({
      orderHash,
      tradeTokenAddress: interestTokens[1].options.address.toLowerCase(),
      txOpts
    });
  });

  describe("tradePositionWithOracle", () => {
    test("should return a web3 PromiEvent", async () => {
      CoreTestUtils.expectPromiEvent(promiEvent);
    });

    test("should successfully trade position with oracle (Kyber)", async () => {
      expect(
        pathOr(null, ["events", "DebugLine"], takeLoanOrderAsTraderReceipt)
      ).toBe(null);

      const receipt = await promiEvent;
      const debugLine = pathOr(null, ["events", "DebugLine"], receipt);

      const replaceRandomFields = CoreTestUtils.makeReplaceRandomFields([
        "0",
        "loanOrderHash"
      ]);

      const logMarginLevels = pipe(
        pathOr(null, ["events", "LogMarginLevels", "returnValues"]),
        replaceRandomFields
      )(receipt);

      const logPositionTraded = pipe(
        pathOr(null, ["events", "LogPositionTraded", "returnValues"]),
        replaceRandomFields
      )(receipt);

      expect(debugLine).toEqual(null);
      expect(logMarginLevels).toMatchSnapshot();
      expect(logPositionTraded).toMatchSnapshot();
    });
  });
});
