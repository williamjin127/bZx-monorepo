import { Fragment } from "react";
import styled from "styled-components";
import Button from "material-ui/Button";

import {
  fromBigNumber,
  getInitialCollateralRequired
} from "../../common/utils";
import Section, { SectionLabel, Divider } from "../../common/FormSection";

import Tokens from "./Tokens";
import Details from "./Details";
import Expiration from "./Expiration";
import Inputs from "./Inputs";

import { validateFillOrder, submitFillOrder } from "./utils";

const SubmitBtn = styled(Button)`
  width: 100%;
  max-width: 480px;
  margin-bottom: 24px;
`;

const Hash = styled.a`
  font-family: monospace;
`;

export default class FillOrder extends React.Component {
  state = {
    fillOrderAmount: 0,
    collateralTokenAddress: this.props.tokens[0].address,
    collateralTokenAmount: `(finish form then reset)`
  };

  componentDidMount() {
    if (this.props.order.makerRole !== `0`) {
      this.refreshCollateralAmountNoEvent();
    }
  }

  /* State setters */

  setStateForCollateralAmount = async (
    loanTokenAddress,
    collateralTokenAddress,
    oracleAddress,
    loanTokenAmount,
    initialMarginAmount
  ) => {
    let collateralRequired = `(finish form then reset)`;
    if (
      loanTokenAddress &&
      collateralTokenAddress &&
      oracleAddress &&
      loanTokenAmount &&
      initialMarginAmount
    ) {
      this.setState({ [`collateralTokenAmount`]: `loading...` });
      collateralRequired = fromBigNumber(
        await getInitialCollateralRequired(
          loanTokenAddress,
          collateralTokenAddress,
          oracleAddress,
          loanTokenAmount,
          initialMarginAmount,
          this.props.b0x
        ),
        1e18
      );
      console.log(`collateralRequired: ${collateralRequired}`);
      if (collateralRequired === 0) {
        collateralRequired = `(unsupported)`;
      }
    }
    this.setState({ [`collateralTokenAmount`]: collateralRequired });
  };

  setStateFor = key => value => this.setState({ [key]: value });

  refreshCollateralAmountNoEvent = async () => {
    await this.setStateForCollateralAmount(
      this.props.order.loanTokenAddress,
      this.props.order.makerRole === `0`
        ? this.state.collateralTokenAddress
        : this.props.order.collateralTokenAddress,
      this.props.order.oracleAddress,
      this.props.order.makerRole === `0`
        ? this.state.fillOrderAmount
        : fromBigNumber(this.props.order.loanTokenAmount, 1e18),
      this.props.order.initialMarginAmount
    );
  };

  refreshCollateralAmount = async event => {
    event.preventDefault();
    await this.refreshCollateralAmountNoEvent();
  };

  handleSubmit = async () => {
    const { order, tokens, b0x, accounts } = this.props;
    const { fillOrderAmount, collateralTokenAddress } = this.state;
    const isFillOrderValid = await validateFillOrder(
      order,
      fillOrderAmount,
      collateralTokenAddress,
      tokens,
      b0x,
      accounts
    );
    if (isFillOrderValid) {
      submitFillOrder(
        order,
        fillOrderAmount,
        collateralTokenAddress,
        b0x,
        accounts
      );
    }
  };

  render() {
    const { order, tokens } = this.props;
    const makerRole = order.makerRole === `0` ? `lender` : `trader`;
    const counterRole = order.makerRole !== `0` ? `lender` : `trader`;
    return (
      <Fragment>
        <Section>
          <SectionLabel>1. Review order info</SectionLabel>
          <p>
            This order was created by{` `}
            <Hash
              href={`https://ropsten.etherscan.io/address/${
                order.makerAddress
              }`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {order.makerAddress}
            </Hash>
            {` `}
            for a{` `}
            {counterRole} to fill.
          </p>
          <Tokens
            tokens={tokens}
            role={makerRole}
            loanTokenAddress={order.loanTokenAddress}
            loanTokenAmount={fromBigNumber(order.loanTokenAmount, 1e18)}
            interestTokenAddress={order.interestTokenAddress}
            interestAmount={fromBigNumber(order.interestAmount, 1e18)}
            collateralTokenAddress={order.collateralTokenAddress}
            collateralTokenAmount={this.state.collateralTokenAmount}
          />
          <Details
            oracles={this.props.oracles}
            initialMarginAmount={order.initialMarginAmount}
            maintenanceMarginAmount={order.maintenanceMarginAmount}
            oracleAddress={order.oracleAddress}
            signature={order.signature}
            feeRecipientAddress={order.feeRecipientAddress}
            lenderRelayFee={fromBigNumber(order.lenderRelayFee, 1e18)}
            traderRelayFee={fromBigNumber(order.traderRelayFee, 1e18)}
          />
          <Expiration
            expirationUnixTimestampSec={order.expirationUnixTimestampSec}
          />
        </Section>
        <Divider />
        <Section>
          <SectionLabel>
            {makerRole === `lender`
              ? `2. Choose parameters and submit`
              : `2. Submit fill order transaction`}
          </SectionLabel>
          {makerRole === `lender` && (
            <Inputs
              tokens={tokens}
              fillOrderAmount={this.state.fillOrderAmount}
              collateralTokenAddress={this.state.collateralTokenAddress}
              loanTokenAddress={order.loanTokenAddress}
              setFillOrderAmount={this.setStateFor(`fillOrderAmount`)}
              setCollateralTokenAddress={this.setStateFor(
                `collateralTokenAddress`
              )}
              collateralTokenAmount={this.state.collateralTokenAmount}
              collateralRefresh={this.refreshCollateralAmount}
            />
          )}
          <SubmitBtn
            variant="raised"
            color="primary"
            onClick={this.handleSubmit}
          >
            Fill Order
          </SubmitBtn>
        </Section>
      </Fragment>
    );
  }
}
