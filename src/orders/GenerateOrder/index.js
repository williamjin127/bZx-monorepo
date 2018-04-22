import moment from "moment";

import { Divider } from "../../common/FormSection";
import RoleSection from "./Role";
import TokensSection from "./Tokens";
import MarginAmountsSection from "./MarginAmounts";
import ExpirationSection from "./Expiration";
import OracleSection from "./Oracle";
import RelayExchangeSection from "./RelayExchange";
import Submission from "./Submission";
import Result from "./Result";

import validateInputs from "./validate";
import { fromBigNumber, getInitialCollateralRequired } from "../../common/utils";
import {
  compileObject,
  addSalt,
  signOrder,
  getOrderHash,
  addNetworkId
} from "./utils";

export default class GenerateOrder extends React.Component {
  state = {
    role: `lender`,

    // token addresses
    loanTokenAddress: this.props.tokens[0].address,
    interestTokenAddress: this.props.tokens[0].address,
    collateralTokenAddress: this.props.tokens[0].address,

    // token amounts
    loanTokenAmount: ``,
    interestAmount: ``,
    collateralTokenAmount: `(finish form then reset)`,

    interestTotalAmount: 0,

    // margin amounts
    initialMarginAmount: 50,
    maintenanceMarginAmount: 25,

    // expiration date/time
    expirationDate: moment().add(7, `days`),

    // oracles
    oracles: this.props.oracles,
    oracleAddress: this.props.oracles[0].address,

    // relay/exchange settings
    sendToRelayExchange: false,
    feeRecipientAddress: `0x0000000000000000000000000000000000000000`,
    lenderRelayFee: 0,
    traderRelayFee: 0,

    orderHash: `0x_temp_order_hash`,
    finalOrder: null
  };

  /* State setters */

  setStateForCollateralAmount = async (loanTokenAddress, collateralTokenAddress, oracleAddress, loanTokenAmount, initialMarginAmount) => {
    var collateralRequired = `(finish form then reset)`;
    if (
      loanTokenAddress &&
      collateralTokenAddress &&
      oracleAddress &&
      loanTokenAmount &&
      initialMarginAmount
    ) {
        this.setState({ [`collateralTokenAmount`]: "loading..." });
        var collateralRequired = fromBigNumber(await getInitialCollateralRequired(
          loanTokenAddress,
          collateralTokenAddress,
          oracleAddress,
          loanTokenAmount,
          initialMarginAmount,
          this.props.b0x
        ), 1e18);
        console.log(`collateralRequired: `+collateralRequired);
        if (collateralRequired == 0) {
          collateralRequired = `(unsupported)`;
        }
    }
    this.setState({ [`collateralTokenAmount`]: collateralRequired });
  }

  setStateFor = key => value => {
    this.setState({ [key]: value });
  }

  setStateForInput = key => event =>
    this.setState({ [key]: event.target.value });

  setStateForTotalInterest = (interestAmount, expirationDate) => {
    var totalInterest = 0;
    if (interestAmount && expirationDate) {
      var exp = expirationDate.unix();
      var now = moment().unix();
      if (exp > now) {
        totalInterest = (exp-now)/86400 * interestAmount;
      }
    }
    this.setState({ [`interestTotalAmount`]: totalInterest });
  }

  setStateForInterestAmount = event => {
    var value = event.target.value;
    this.setState({ [`interestAmount`]: value });
    this.setStateForTotalInterest(value, this.state.expirationDate);
  }

  setStateForExpirationDate = value => {
    this.setState({ [`expirationDate`]: value });
    this.setStateForTotalInterest(this.state.interestAmount, value);
  }

  setRole = (e, value) => {
    this.setState({ role: value });
  }

  setRelayCheckbox = (e, value) =>
    this.setState({ sendToRelayExchange: value });

  refreshCollateralAmount = async (event) => {
    event.preventDefault();
    if (this.state.role == `trader`) {
      this.setStateForCollateralAmount(
        this.state.loanTokenAddress,
        this.state.collateralTokenAddress,
        this.state.oracleAddress,
        this.state.loanTokenAmount,
        this.state.initialMarginAmount
      );
    }
  }

  /* Submission handler */

  handleSubmit = async () => {
    const isValid = await validateInputs(
      this.props.b0x,
      this.props.accounts,
      this.state,
      this.props.tokens
    );
    this.setState({ orderHash: null, finalOrder: null });
    if (isValid) {
      const orderObject = await compileObject(
        this.props.web3,
        this.state,
        this.props.accounts[0],
        this.props.b0x
      );
      const saltedOrderObj = addSalt(orderObject);
      console.log(saltedOrderObj);
      const orderHash = getOrderHash(saltedOrderObj);
      try {
        const signature = await signOrder(
          orderHash,
          this.props.accounts,
          this.props.b0x
        );

        const orderWithSignature = {
          ...saltedOrderObj,
          signature
        };
        console.log(`orderHash`, orderHash);
        const finalOrder = await addNetworkId(
          orderWithSignature,
          this.props.web3
        );
        const isSigValid = await this.props.b0x.isValidSignatureAsync({
          account: this.props.accounts[0].toLowerCase(),
          orderHash,
          signature
        });
        console.log(`isSigValid`, isSigValid);
        this.setState({ orderHash, finalOrder });
      } catch (e) {
        console.log(e);
      }
    }
  };

  render() {
    return (
      <div>
        <RoleSection role={this.state.role} setRole={this.setRole} />

        <Divider />

        <OracleSection
          oracleAddress={this.state.oracleAddress}
          setOracleAddress={this.setStateForInput(`oracleAddress`)}
          oracles={this.state.oracles}
        />

        <Divider />

        <TokensSection
          tokens={this.props.tokens}
          role={this.state.role}
          // state setters
          setStateForAddress={this.setStateFor}
          setStateForInput={this.setStateForInput}
          setStateForInterestAmount={this.setStateForInterestAmount}
          // address states
          loanTokenAddress={this.state.loanTokenAddress}
          interestTokenAddress={this.state.interestTokenAddress}
          collateralTokenAddress={this.state.collateralTokenAddress}
          // token amounts
          loanTokenAmount={this.state.loanTokenAmount}
          collateralTokenAmount={this.state.collateralTokenAmount}
          interestAmount={this.state.interestAmount}
          interestTotalAmount={this.state.interestTotalAmount}

          collateralRefresh={this.refreshCollateralAmount}
        />

        <Divider />

        <MarginAmountsSection
          setStateForInput={this.setStateForInput}
          initialMarginAmount={this.state.initialMarginAmount}
          maintenanceMarginAmount={this.state.maintenanceMarginAmount}
        />

        <Divider />

        <ExpirationSection
          setExpirationDate={this.setStateForExpirationDate}
          expirationDate={this.state.expirationDate}
        />

        <Divider />

        <RelayExchangeSection
          // state setters
          setStateForInput={this.setStateForInput}
          setRelayCheckbox={this.setRelayCheckbox}
          // form states
          sendToRelayExchange={this.state.sendToRelayExchange}
          feeRecipientAddress={this.state.feeRecipientAddress}
          lenderRelayFee={this.state.lenderRelayFee}
          traderRelayFee={this.state.traderRelayFee}
        />

        <Divider />

        <Submission onSubmit={this.handleSubmit} />

        <Result
          orderHash={this.state.orderHash}
          signedOrderObject={this.state.finalOrder}
        />
      </div>
    );
  }
}
