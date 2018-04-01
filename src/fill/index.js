import * as utils from "../core/utils";
import { getContracts } from "../contracts";
import * as Addresses from "../addresses";

export const takeLoanOrderAsLender = async (web3, host, order, txOpts) => {
  const b0xContract = await utils.getContractInstance(
    web3,
    getContracts(host).B0x.abi,
    Addresses.getAddresses(host).B0x
  );

  const orderAddresses = [
    order.makerAddress,
    order.loanTokenAddress,
    order.interestTokenAddress,
    order.collateralTokenAddress,
    order.feeRecipientAddress,
    order.oracleAddress
  ];

  const orderValues = [
    order.loanTokenAmount,
    order.interestAmount,
    order.initialMarginAmount,
    order.maintenanceMarginAmount,
    order.lenderRelayFee,
    order.traderRelayFee,
    order.expirationUnixTimestampSec,
    order.makerRole,
    order.salt
  ];

  return b0xContract.methods
    .takeLoanOrderAsLender(orderAddresses, orderValues, order.signature)
    .send({
      from: txOpts.from,
      gas: txOpts.gas,
      gasPrice: txOpts.gasPrice
    });
};

export const takeLoanOrderAsTrader = async (
  web3,
  host,
  order,
  collateralTokenAddress,
  loanTokenAmountFilled,
  txOpts
) => {
  const b0xContract = await utils.getContractInstance(
    web3,
    getContracts(host).B0x.abi,
    Addresses.getAddresses(host).B0x
  );

  const orderAddresses = [
    order.makerAddress,
    order.loanTokenAddress,
    order.interestTokenAddress,
    order.collateralTokenAddress,
    order.feeRecipientAddress,
    order.oracleAddress
  ];

  const orderValues = [
    order.loanTokenAmount,
    order.interestAmount,
    order.initialMarginAmount,
    order.maintenanceMarginAmount,
    order.lenderRelayFee,
    order.traderRelayFee,
    order.expirationUnixTimestampSec,
    order.makerRole,
    order.salt
  ];

  return b0xContract.methods
    .takeLoanOrderAsTrader(
      orderAddresses,
      orderValues,
      collateralTokenAddress,
      loanTokenAmountFilled,
      order.signature
    )
    .send({
      from: txOpts.from,
      gas: txOpts.gas,
      gasPrice: txOpts.gasPrice
    });
};
