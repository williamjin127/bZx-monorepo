import { Fragment } from "react";
import styled from "styled-components";
import Input from "@material-ui/core/Input";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import { FormControl, FormControlLabel } from "@material-ui/core";
import Checkbox from "@material-ui/core/Checkbox";
import TextField from "@material-ui/core/TextField";
import Section, { SectionLabel } from "../../common/FormSection";

const AddressTextField = styled(TextField)`
  max-width: 480px !important;
`;

export default ({
  sendToRelayExchange,
  pushOnChain,
  setRelayCheckbox,
  setStateForInput,
  feeRecipientAddress,
  takerAddress,
  lenderRelayFee,
  traderRelayFee
}) => (
  <Section>
    <SectionLabel>Advanced Settings</SectionLabel>

    <div>
      <FormControlLabel
        control={
          <Checkbox 
            checked={sendToRelayExchange}
            onChange={setRelayCheckbox}  
          />
        }
        label="Enable advanced settings"
      />
      {/*disabled={pushOnChain}*/}
    </div>

    {sendToRelayExchange && (
      <Fragment>
        <AddressTextField
          value={takerAddress}
          onChange={setStateForInput(`takerAddress`)}
          label="Taker Address"
          margin="normal"
          fullWidth
        />
        <AddressTextField
          value={feeRecipientAddress}
          onChange={setStateForInput(`feeRecipientAddress`)}
          label="Relay/Exchange Address"
          margin="normal"
          fullWidth
        />
        <FormControl margin="normal">
          <InputLabel>Lender Relay Fee</InputLabel>
          <Input
            value={lenderRelayFee}
            type="number"
            onChange={setStateForInput(`lenderRelayFee`)}
            endAdornment={<InputAdornment position="end">BZRX</InputAdornment>}
          />
        </FormControl>
        <FormControl margin="normal">
          <InputLabel>Trader Relay Fee</InputLabel>
          <Input
            value={traderRelayFee}
            type="number"
            onChange={setStateForInput(`traderRelayFee`)}
            endAdornment={<InputAdornment position="end">BZRX</InputAdornment>}
          />
        </FormControl>
      </Fragment>
    )}
  </Section>
);
