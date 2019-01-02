import { BigNumber } from "@0xproject/utils";
import { assert } from "@0xproject/assert";
import BN from "bn.js";
import Web3Utils from "web3-utils";
import * as constants from "../constants";
import { SchemaValidator } from "../../schemas/bZx_json_schemas";
import { getContracts } from "../../contracts";
import * as Addresses from "../../addresses";

export const noop = () => {};

export const bigNumberToBN = value => new BN(value.toString(), 10);

export const generatePseudoRandomSalt = () => {
  // BigNumber.random returns a pseudo-random number between 0 & 1
  // with a passed in number of decimal places.
  // Source: https://mikemcl.github.io/bignumber.js/#random
  const randomNumber = BigNumber.random(
    constants.MAX_DIGITS_IN_UNSIGNED_256_INT
  );
  const factor = new BigNumber(10).pow(
    constants.MAX_DIGITS_IN_UNSIGNED_256_INT - 1
  );
  const salt = randomNumber.times(factor).round();
  return salt;
};

const getOrderValues = (order, shouldFormatAsStrings) => {
  // Must be strings in production for Web3Utils.soliditySha3 for some reason
  if (shouldFormatAsStrings) {
    return [
      order.loanTokenAmount.toString(),
      order.interestAmount.toString(),
      order.initialMarginAmount.toString(),
      order.maintenanceMarginAmount.toString(),
      order.lenderRelayFee.toString(),
      order.traderRelayFee.toString(),
      order.maxDurationUnixTimestampSec.toString(),
      order.expirationUnixTimestampSec.toString(),
      order.makerRole.toString(),
      order.withdrawOnOpen.toString(),
      order.salt.toString()
    ];
  }
  return [
    bigNumberToBN(order.loanTokenAmount),
    bigNumberToBN(order.interestAmount),
    bigNumberToBN(order.initialMarginAmount),
    bigNumberToBN(order.maintenanceMarginAmount),
    bigNumberToBN(order.lenderRelayFee),
    bigNumberToBN(order.traderRelayFee),
    bigNumberToBN(order.maxDurationUnixTimestampSec),
    bigNumberToBN(order.expirationUnixTimestampSec),
    bigNumberToBN(order.makerRole),
    bigNumberToBN(order.withdrawOnOpen),
    bigNumberToBN(order.salt)
  ];
};

const getLoanOrderHashArgs = (order, shouldFormatAsStrings) => {
  const orderAddresses = [
    order.makerAddress,
    order.loanTokenAddress,
    order.interestTokenAddress,
    order.collateralTokenAddress,
    order.feeRecipientAddress,
    order.oracleAddress,
    order.takerAddress,
    order.tradeTokenToFillAddress
  ];
  const orderValues = getOrderValues(order, shouldFormatAsStrings);
  const oracleData = order.oracleData || "0x";

  return { orderAddresses, orderValues, oracleData };
};

export const doesContractExistAtAddress = async (web3, address) => {
  const code = await web3.eth.getCode(address);
  // Regex matches 0x0, 0x00, 0x in order to accommodate poorly implemented clients
  const codeIsEmpty = /^0x0{0,40}$/i.test(code);
  return !codeIsEmpty;
};

export const getContractInstance = (web3, abi, address) => {
  assert.isETHAddressHex("address", address);
  const contract = new web3.eth.Contract(abi, address);
  return contract;
};

export const getLoanOrderHashHex = order => {
  const { orderAddresses, orderValues, oracleData } = getLoanOrderHashArgs(order, true);
  const orderHashHex = Web3Utils.soliditySha3(
    { t: "address", v: order.bZxAddress },
    { t: "address[8]", v: orderAddresses },
    { t: "uint256[11]", v: orderValues },
    { t: "bytes", v: oracleData }
  );
  return orderHashHex;
};

export const getLoanOrderHashAsync = async ({ web3, networkId }, order) => {
  const { orderAddresses, orderValues, oracleData } = getLoanOrderHashArgs(order, true);
  const bZxContract = await getContractInstance(
    web3,
    getContracts(networkId).BZx.abi,
    Addresses.getAddresses(networkId).BZx
  );
  return bZxContract.methods
    .getLoanOrderHash(
      orderAddresses,
      orderValues,
      oracleData
    )
    .call();
};

export const doesConformToSchema = (variableName, value, schema) => {
  const schemaValidator = new SchemaValidator();
  const validationResult = schemaValidator.validate(value, schema);
  const hasValidationErrors = validationResult.errors.length > 0;
  const msg = `Expected ${variableName} to conform to schema ${
    schema.id
  }\nEncountered: ${JSON.stringify(
    value,
    null,
    "\t"
  )}\nValidation errors: ${validationResult.errors.join(", ")}`;
  assert.assert(!hasValidationErrors, msg);
};

export const toChecksumAddress = addr => Web3Utils.toChecksumAddress(addr);

export const requestFaucetToken = (
  { web3, networkId },
  { tokenAddress, receiverAddress, getObject, txOpts }
) => {
  const faucetContract = getContractInstance(
    web3,
    getContracts(networkId).TestNetFaucet.abi,
    Addresses.getAddresses(networkId).TestNetFaucet
  );

  const txObj = faucetContract.methods.faucet(
    toChecksumAddress(tokenAddress),
    toChecksumAddress(receiverAddress)
  );
  console.log(`requestFaucetToken: ${txObj.encodeABI()}`);

  if (getObject) {
    return txObj;
  }
  return txObj.send(txOpts);
};

export const getWeb3Contract = ({ web3, networkId }, contractName, contractAddress) => getContractInstance(
    web3,
    getContracts(networkId)[contractName].abi,
    contractAddress ? contractAddress : Addresses.getAddresses(networkId)[contractName]
  );
