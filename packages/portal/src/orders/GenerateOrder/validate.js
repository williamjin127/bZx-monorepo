import { getTrackedTokens } from "../../common/trackedTokens";
import { getTokenBalance, getSymbol, getDecimals } from "../../common/tokens";
import { toBigNumber } from "../../common/utils";

const validRange = (min, max, val) => {
  if (val <= max && val >= min) {
    return true;
  }
  throw new Error(`Invalid range`);
};

const checkCoinsAdded = ({ loanTokenAddress, interestTokenAddress, collateralTokenAddress, role }, tokens) => {
  const trackedTokens = getTrackedTokens(tokens);

  if (role === `lender`) {
    return trackedTokens.includes(loanTokenAddress);
  }
  const a = trackedTokens.includes(interestTokenAddress);
  const b = trackedTokens.includes(collateralTokenAddress);
  return a && b;
};

const checkAllowance = async (bZx, accounts, tokenAddress) => {
  const allowance = await bZx.getAllowance({
    tokenAddress,
    ownerAddress: accounts[0].toLowerCase()
  });
  return allowance.toNumber() !== 0;
};

const checkCoinsApproved = async (bZx, accounts, state) => {
  const { loanTokenAddress, interestTokenAddress, collateralTokenAddress, role } = state;
  if (role === `lender`) {
    const loanTokenAllowed = await checkAllowance(bZx, accounts, loanTokenAddress);
    return loanTokenAllowed;
  }
  const a = await checkAllowance(bZx, accounts, interestTokenAddress);
  const b = await checkAllowance(bZx, accounts, collateralTokenAddress);
  return a && b;
};

const checkCoinsAllowed = (state, tokens, networkId) => {
  const { loanTokenAddress, collateralTokenAddress, role } = state;
  const notAllowed = {
    1: [`BZRX`, `BZRXFAKE`],
    3: [`BZRX`, `BZRXFAKE`],
    4: [`BZRX`],
    42: [`BZRX`],
    50: [`BZRX`]
  };

  // early return if there is no restricted list for this network
  if (notAllowed[networkId] === undefined || notAllowed[networkId] === []) return true;

  const loanToken = tokens.filter(t => t.address === loanTokenAddress)[0];
  const invalidLoanToken = notAllowed[networkId].includes(loanToken && loanToken.symbol);

  if (role === `lender`) {
    return !invalidLoanToken;
  }

  // for trader, check collateral token as well
  const collateralToken = tokens.filter(t => t.address === collateralTokenAddress)[0];

  const invalidCollateralToken = notAllowed[networkId].includes(collateralToken && collateralToken.symbol);

  const invalid = invalidLoanToken || invalidCollateralToken;
  return !invalid;
};

export default async (bZx, accounts, state, tokens, web3) => {
  const {
    role,
    loanTokenAddress,
    interestTokenAddress,
    collateralTokenAddress,
    loanTokenAmount,
    interestTotalAmount,
    collateralTokenAmount,
    interestAmount,
    initialMarginAmount,
    maintenanceMarginAmount,
    feeRecipientAddress
  } = state;
  if (loanTokenAmount === `` || interestAmount === ``) {
    alert(`Please enter a valid token amount.`);
    return false;
  }

  if (!web3.utils.isAddress(feeRecipientAddress)) {
    alert(`Please enter a valid Relay/Exchange Address.`);
    return false;
  }

  try {
    validRange(40, 100, initialMarginAmount);
    validRange(20, 90, maintenanceMarginAmount);
    if (maintenanceMarginAmount > initialMarginAmount) {
      throw Error(`The maintenance margin amount cannot be larger than initial margin amount.`);
    }
  } catch (error) {
    // eslint-disable-next-line no-undef
    alert(`Margin amounts are invalid: ${error.message}`);
    return false;
  }

  const coinsAllowed = checkCoinsAllowed(state, tokens, bZx.networkId);
  if (!coinsAllowed) {
    alert(
      // `The selected tokens are not yet supported for lending or collateral.`
      `Token BZRX is not yet supported for lending or collateral. It can be used to pay interest.`
    );
    return false;
  }

  const coinsAdded = checkCoinsAdded(state, tokens);
  if (!coinsAdded) {
    alert(
      `Some of your selected tokens have not been added to the tracked tokens list. Please go to the Balances page and add these tokens.`
    );
    return false;
  }

  const coinsApproved = await checkCoinsApproved(bZx, accounts, state);
  if (!coinsApproved) {
    alert(
      `Some of your selected tokens have not been approved. Please go to the Balances page and approve these tokens.`
    );
    return false;
  }

  if (role === `trader`) {
    const interestTokenBalance = await getTokenBalance(bZx, interestTokenAddress, accounts);
    if (toBigNumber(interestTotalAmount, 10 ** getDecimals(tokens, interestTokenAddress)).gt(interestTokenBalance)) {
      alert(
        `Your interest token balance is too low. You need at least ${interestTotalAmount} ${getSymbol(
          tokens,
          interestTokenAddress
        )} create this order.`
      );
      return false;
    }

    const collateralTokenBalance = await getTokenBalance(bZx, collateralTokenAddress, accounts);
    if (
      toBigNumber(collateralTokenAmount, 10 ** getDecimals(tokens, collateralTokenAddress)).gt(collateralTokenBalance)
    ) {
      alert(
        `Your collteral token balance is too low. You need at least ${collateralTokenAmount} ${getSymbol(
          tokens,
          collateralTokenAddress
        )} create this order.`
      );
      return false;
    }
  } else {
    const loanTokenBalance = await getTokenBalance(bZx, loanTokenAddress, accounts);
    if (toBigNumber(loanTokenAmount, 10 ** getDecimals(tokens, loanTokenAddress)).gt(loanTokenBalance)) {
      alert(
        `Your loan token balance is too low. You need at least ${loanTokenAmount} ${getSymbol(
          tokens,
          loanTokenAddress
        )} create this order.`
      );
      return false;
    }
  }

  return true;
};
