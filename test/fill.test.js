/* globals test, describe, expect, beforeAll, afterAll */
import { pathOr } from "ramda";
import B0xJS from "../src";
import b0xJS from "./setup";
import * as Addresses from "./constants/addresses";
import makeOrder from "./utils/order";

describe("filling orders", () => {
  const accounts = [Addresses.ACCOUNTS[0], Addresses.ACCOUNTS[1]];
  beforeAll(async () => {
    const promises = accounts.map(account =>
      b0xJS.setAllowanceUnlimited({
        tokenAddress: Addresses.EtherToken,
        ownerAddress: account
      })
    );
    await Promise.all(promises);
  });

  afterAll(async () => {
    const promises = accounts.map(account =>
      b0xJS.resetAllowance({
        tokenAddress: Addresses.EtherToken,
        ownerAddress: account
      })
    );
    await Promise.all(promises);
  });

  const order = makeOrder({ makerAddress: Addresses.ACCOUNTS[0] });
  const signerAddress = order.makerAddress;
  const txOpts = { from: Addresses.ACCOUNTS[1], gas: 1000000 };

  describe("takeLoanOrderAsLender", async () => {
    test("should return total amount of loanToken borrowed", async () => {
      const orderHashHex = B0xJS.getLoanOrderHashHex(order);
      const signature = await b0xJS.signOrderHashAsync(
        orderHashHex,
        signerAddress
      );
      const receipt = await b0xJS.takeLoanOrderAsLender(
        { ...order, signature },
        txOpts
      );

      const loanTokenAmountFilled = pathOr(
        null,
        [
          "events",
          "LoanOrderTakenAmounts",
          "returnValues",
          "loanTokenAmountFilled"
        ],
        receipt
      );
      expect(loanTokenAmountFilled).toBe("0");
    });
  });

  describe("takeLoanOrderAsTrader", async () => {
    test("should return total amount of loanToken borrowed", async () => {
      const orderHashHex = B0xJS.getLoanOrderHashHex(order);
      const signature = await b0xJS.signOrderHashAsync(
        orderHashHex,
        signerAddress
      );

      const collateralTokenAddress = Addresses.EtherToken;
      const loanTokenAmountFilled = "20";

      const receipt = await b0xJS.takeLoanOrderAsTrader(
        { ...order, signature },
        collateralTokenAddress,
        loanTokenAmountFilled,
        txOpts
      );

      const loanTokenAmountFilledReturn = pathOr(
        null,
        [
          "events",
          "LoanOrderTakenAmounts",
          "returnValues",
          "loanTokenAmountFilled"
        ],
        receipt
      );
      expect(loanTokenAmountFilledReturn).toBe("0");
    });
  });
});
