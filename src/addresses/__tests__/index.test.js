/* globals test, expect, describe */
import B0xJS from "../../index";

describe("addresses", () => {
  test("should return an object of addresses", async () => {
    expect(B0xJS.addresses).toMatchSnapshot();
  });
});
