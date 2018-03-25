/* globals test, describe, expect */
import { constants } from "0x.js/lib/src/utils/constants";
import b0xJS from "../../../test/setup";
import * as oracles from "../index";
import * as Addresses from "../../../test/constants/addresses";
import Contracts from "../../contracts";

describe("oracles", () => {
  const testOracleNames = ["b0xOracle", "coolOracle", "anotherOracle"];
  const testOracleAddresses = [
    Contracts.B0xOracle.address,
    constants.NULL_ADDRESS,
    constants.NULL_ADDRESS
  ];

  test("cleanOracleNames", () => {
    const oracleNames = oracles.cleanOracleNames({
      oracleNameLengths: testOracleNames.map(name => name.length),
      oracleNamesAllConcat: testOracleNames.join("")
    });

    expect(oracleNames).toEqual(testOracleNames);
  });

  test("formatOracleList", () => {
    const expected = [
      { name: "b0xOracle", address: Contracts.B0xOracle.address },
      { name: "coolOracle", address: constants.NULL_ADDRESS },
      { name: "anotherOracle", address: constants.NULL_ADDRESS }
    ];

    const oracleList = oracles.formatOracleList({
      oracleAddresses: testOracleAddresses,
      oracleNames: testOracleNames
    });

    expect(oracleList).toEqual(expected);
  });

  describe("getOracleList", async () => {
    test("should return formatted list of oracles", async () => {
      const expected = [
        { name: "b0xOracle", address: Contracts.B0xOracle.address }
      ];
      const oracleList = await b0xJS.getOracleList();
      expect(oracleList).toEqual(expected);
    });
  });

  describe("isTradeSupported", async () => {
    test("should return true for pair of supported tokens", async () => {
      const oracleAddress = Contracts.B0xOracle.address;
      const isSupported = await b0xJS.isTradeSupported({
        sourceTokenAddress: Addresses.ZRXToken,
        destTokenAddress: Addresses.EtherToken,
        oracleAddress
      });
      expect(isSupported).toBe(true);
    });
  });
});
