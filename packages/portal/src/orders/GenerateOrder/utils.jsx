import styled from "styled-components";
import { BZxJS } from "@bzxnetwork/bzx.js"; // eslint-disable-line
import { toBigNumber } from "../../common/utils";
import getNetworkId from "../../web3/getNetworkId";
import { getDecimals } from "../../common/tokens";

const TxHashLink = styled.a.attrs({
  target: `_blank`,
  rel: `noopener noreferrer`
})`
  font-family: monospace;
  display: block;
  text-overflow: ellipsis;
  overflow: auto;
}
`;

export const compileObject = async (web3, state, account, bZx, tokens) => {
  const { sendToRelayExchange } = state;
  console.log(tokens);
  return {
    bZxAddress: bZx.addresses.BZx,
    makerAddress: account.toLowerCase(),
    makerRole: (state.role === `lender` ? 0 : 1).toString(),

    takerAddress: state.takerAddress.toLowerCase(),
    
    withdrawOnOpen: (state.role === `trader` && state.withdrawOnOpen ? 1 : 0).toString(),

    tradeTokenToFillAddress: state.tradeTokenToFillAddress,

    // addresses
    loanTokenAddress: state.loanTokenAddress,
    interestTokenAddress: state.interestTokenAddress,
    collateralTokenAddress:
      state.role === `lender`
        ? `0x0000000000000000000000000000000000000000`
        : state.collateralTokenAddress,
    feeRecipientAddress: sendToRelayExchange
      ? state.feeRecipientAddress.toLowerCase()
      : `0x0000000000000000000000000000000000000000`,
    oracleAddress: state.oracleAddress,

    // token amounts
    loanTokenAmount: toBigNumber(
      state.loanTokenAmount,
      10 ** getDecimals(tokens, state.loanTokenAddress)
    ).toFixed(0),
    interestAmount: toBigNumber(
      state.interestAmount,
      10 ** getDecimals(tokens, state.interestTokenAddress)
    ).toFixed(0),

    // margin amounts
    initialMarginAmount: state.initialMarginAmount.toString(),
    maintenanceMarginAmount: state.maintenanceMarginAmount.toString(),

    // relay fees
    lenderRelayFee: toBigNumber(
      sendToRelayExchange ? state.lenderRelayFee : 0,
      1e18
    ).toFixed(0),
    traderRelayFee: toBigNumber(
      sendToRelayExchange ? state.traderRelayFee : 0,
      1e18
    ).toFixed(0),

    // max loan duration
    maxDurationUnixTimestampSec: Math.round(state.maxDuration).toString(),

    // expiration date/time
    expirationUnixTimestampSec: state.expirationDate.unix().toString(),

    oracleData: state.oracleData
  };
};

export const addSalt = obj => {
  const salt = BZxJS.generatePseudoRandomSalt();
  return {
    ...obj,
    salt
  };
};

export const addNetworkId = async (order, web3) => {
  const networkId = await getNetworkId(web3);
  return {
    ...order,
    networkId
  };
};

export const signOrder = async (orderHash, accounts, bZx) => {
  if (bZx.portalProviderName !== `MetaMask`) {
    alert(`Please confirm this action on your device.`);
  }
  let signature;
  try {
    signature = await bZx.signOrderHashAsync(
      orderHash,
      accounts[0].toLowerCase(),
      bZx.portalProviderName === `MetaMask`
    );
  } catch (e) {
    console.error(e.message);
    alert(`Unable to sign this order. Please try again.`);
    return null;
  }
  alert();

  const isValidSignature = BZxJS.isValidSignature({
    account: accounts[0].toLowerCase(),
    orderHash,
    signature
  });
  const isValidSignatureBZx = await bZx.isValidSignatureAsync({
    account: accounts[0].toLowerCase(),
    orderHash,
    signature
  });
  console.log(`${signature} isValidSignature`, isValidSignature);
  console.log(`${signature} isValidSignatureBZx`, isValidSignatureBZx);
  return signature;
};

export const getOrderHash = obj => BZxJS.getLoanOrderHashHex(obj);

export const pushOrderOnChain = (order, web3, bZx, accounts) => {
  const txOpts = {
    from: accounts[0],
    gas: 2000000,
    gasPrice: window.defaultGasPrice.toString()
  };

  // console.log(`order`, order);
  // console.log(`txOpts`, txOpts);

  if (bZx.portalProviderName !== `MetaMask`) {
    alert(`Please confirm this transaction on your device.`);
  }

  const txObj = bZx.pushLoanOrderOnChain({
    order,
    getObject: true
  });
  console.log(txObj);

  try {
    txObj
      .estimateGas(txOpts)
      .then(gas => {
        console.log(gas);
        txOpts.gas = window.gasValue(gas);
        txObj
          .send(txOpts)
          .once(`transactionHash`, hash => {
            alert(`Transaction submitted, transaction hash:`, {
              component: () => (
                <TxHashLink href={`${bZx.etherscanURL}tx/${hash}`}>
                  {hash}
                </TxHashLink>
              )
            });
          })
          .then(() => {
            console.log();
            alert(`Your loan order has been pushed on chain.`);
          })
          .catch(error => {
            console.error(error.message);
            if (
              error.message.includes(`denied transaction signature`) ||
              error.message.includes(`Condition of use not satisfied`) ||
              error.message.includes(`Invalid status`)
            ) {
              alert();
            }
          });
      })
      .catch(error => {
        console.error(error);
        alert(
          `The transaction is failing. This loan order cannot be pushed on chain at this time. Please check the parameters of the order and try again later.`
        );
      });
  } catch (error) {
    console.error(error);
    alert(
      `The transaction is failing. This loan order cannot be pushed on chain at this time. Please check the parameters of the order and try again later.`
    );
  }

  return true;
};
