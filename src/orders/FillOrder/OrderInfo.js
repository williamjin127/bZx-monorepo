import styled from "styled-components";
import Button from "material-ui/Button";

import Tokens from "./Tokens";
import Amounts from "./Amounts";
import Expiration from "./Expiration";
import Inputs from "./Inputs";

import { validateFillOrder, submitFillOrder } from "./utils";

const Submission = styled.div`
  text-align: center;
  margin-bottom: 24px;
`;

const SubmitBtn = styled(Button)`
  width: 100%;
  max-width: 480px;
`;

export default class OrderInfo extends React.Component {
  state = {
    fillOrderAmount: 0,
    collateralTokenAddress: this.props.tokens[0].address
  };

  setStateFor = key => value => this.setState({ [key]: value });

  handleSubmit = () => {
    const { order } = this.props;
    const { fillOrderAmount, collateralTokenAddress } = this.state;
    const isFillOrderValid = validateFillOrder(
      order,
      fillOrderAmount,
      collateralTokenAddress
    );
    if (isFillOrderValid) {
      submitFillOrder(order, fillOrderAmount, collateralTokenAddress);
    } else {
      alert(`There is something wrong with your order`);
    }
  };

  render() {
    const { order, tokens } = this.props;
    const role = order.makerRole === `0` ? `lender` : `trader`;
    return (
      <div>
        <Tokens
          tokens={tokens}
          role={role}
          loanTokenAddress={order.loanTokenAddress}
          loanTokenAmount={order.loanTokenAmount}
          interestTokenAddress={order.interestTokenAddress}
          interestAmount={order.interestAmount}
          collateralTokenAddress={order.collateralTokenAddress}
        />
        <Amounts
          initialMarginAmount={order.initialMarginAmount}
          maintenanceMarginAmount={order.maintenanceMarginAmount}
          lenderRelayFee={order.lenderRelayFee}
          traderRelayFee={order.traderRelayFee}
        />
        <Expiration
          expirationUnixTimestampSec={order.expirationUnixTimestampSec}
        />
        {role === `lender` && (
          <Inputs
            tokens={tokens}
            fillOrderAmount={this.state.fillOrderAmount}
            collateralTokenAddress={this.state.collateralTokenAddress}
            loanTokenAddress={order.loanTokenAddress}
            setFillOrderAmount={this.setStateFor(`fillOrderAmount`)}
            setCollateralTokenAddress={this.setStateFor(
              `collateralTokenAddress`
            )}
          />
        )}
        <Submission>
          <SubmitBtn
            variant="raised"
            color="primary"
            onClick={this.handleSubmit}
          >
            Fill Order
          </SubmitBtn>
        </Submission>
      </div>
    );
  }
}
