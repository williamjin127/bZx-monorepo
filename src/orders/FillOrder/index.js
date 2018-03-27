import { Fragment } from "react";
import styled from "styled-components";
import Typography from "material-ui/Typography";
import MuiButton from "material-ui/Button";
import { SectionLabel } from "../../common/FormSection";
import FillOrderPage from "./FillOrder";
import { getOrderHash } from "./utils";

const TextArea = styled.textarea`
  margin: 12px 0;
  width: 100%;
  max-width: 480px;
  font-family: monospace;
`;

const BackLink = styled(Typography)`
  display: inline-block !important;
  margin-bottom: 12px !important;
  text-decoration: underline;
  cursor: pointer;
`;

const Button = styled(MuiButton)`
  display: block !important;
`;

export default class FillOrder extends React.Component {
  state = { value: ``, showOrderInfo: false };

  reset = () => this.setState({ showOrderInfo: false });

  handleChange = e => this.setState({ value: e.target.value });

  handleSubmit = () => {
    const JSONOrder = JSON.parse(this.state.value);
    const hex = getOrderHash(JSONOrder);
    if (hex) {
      this.setState({ showOrderInfo: true });
    } else {
      alert(`Please check your JSON input.`);
    }
  };

  render() {
    const { showOrderInfo, value } = this.state;
    if (showOrderInfo) {
      return (
        <Fragment>
          <BackLink onClick={this.reset}>Go Back</BackLink>
          <FillOrderPage
            order={JSON.parse(value)}
            tokens={this.props.tokens}
            oracles={this.props.oracles}
            b0x={this.props.b0x}
            accounts={this.props.accounts}
          />
        </Fragment>
      );
    }
    return (
      <div>
        <SectionLabel>Fill an order</SectionLabel>
        <Typography>Paste your JSON order below:</Typography>
        <TextArea
          cols="30"
          rows="10"
          value={value}
          onChange={this.handleChange}
        />
        <Button variant="raised" color="primary" onClick={this.handleSubmit}>
          Get Order Info
        </Button>
      </div>
    );
  }
}
