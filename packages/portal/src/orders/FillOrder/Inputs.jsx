import { Fragment } from "react";
import styled from "styled-components";
import Tooltip from "@material-ui/core/Tooltip";
import Input from "@material-ui/core/Input";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import { FormControl, FormControlLabel, FormHelperText }  from "@material-ui/core";
import Checkbox from "@material-ui/core/Checkbox";
import { getSymbol } from "../../common/tokens";

import TokenPicker from "../../common/TokenPicker";

const Container = styled.div`
  display: flex;
  width: 100%;
  text-align: center;
  padding: 24px 0;
  justify-content: center;
  align-items: center;
`;

const DataContainer = styled.div`
  width: 230px;
  margin: 24px;
  text-align: center;
`;

const Title = styled.div`
  margin-bottom: 24px !important;
  color: rgba(0, 0, 0, 0.54);
  padding: 0;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
`;

const MoreInfo = styled.span`
  text-decoration: underline;
  cursor: pointer;
`;

const CenteredFormHelperText = styled(FormHelperText)`
  text-align: center !important;
`;

const FormHelperTextWithDetail = styled(FormHelperText)`
  display: flex;
`;

const RightJustified = styled.div`
  font-size: 0.75rem;
  position: absolute;
  right: 0px;
  max-width: 190px;
  word-break: break-word;
  text-align: right;
`;

const AddressLink = styled.a.attrs({
  target: `_blank`,
  rel: `noopener noreferrer`
})`
  //display: inline-block;
  //font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 20ch;
  color: rgba(0, 0, 0, 0.54);
`;

export default ({
  bZx,
  tokens,
  fillOrderAmount,
  collateralTokenAddress,
  loanTokenAddress,
  collateralTokenAmount,
  collateralRefresh,
  overCollateralize,
  setFillOrderAmount,
  setCollateralTokenAddress,
  setOverCollateralize
}) => {
  const symbol = getSymbol(tokens, loanTokenAddress);
  return (
    <Fragment>
      <Container>
        <DataContainer>
          <Title>Amount to Borrow</Title>
          <FormControl>
            <InputLabel>Loan amount</InputLabel>
            <Input
              type="number"
              value={fillOrderAmount}
              onChange={e => setFillOrderAmount(e.target.value)}
              endAdornment={
                <InputAdornment position="end">{symbol}</InputAdornment>
              }
            />
            <FormHelperText component="div">
              <Tooltip
                title={
                  <div style={{ maxWidth: `300px` }}>
                    This sets the amount to be borrowed. It cannot be larger
                    than the available amount being loaned above.
                  </div>
                }
              >
                <MoreInfo>More Info</MoreInfo>
              </Tooltip>
            </FormHelperText>
          </FormControl>
        </DataContainer>
        <DataContainer>
          <Tooltip
            title={
              <div style={{ maxWidth: `300px` }}>
                This token amount will be calculated when the order is filled
                (either partially or fully). It will be set to the amount needed
                to satisfy the initial margin amount to cover the amount of loan
                token borrowed.
              </div>
            }
          >
            <Title>Collateral Token</Title>
          </Tooltip>
          <TokenPicker
            tokens={tokens}
            value={collateralTokenAddress}
            setAddress={setCollateralTokenAddress}
          />
          <CenteredFormHelperText component="div">
            <AddressLink
              href={`${bZx.etherscanURL}/address/${collateralTokenAddress}`}
            >
              Etherscan
            </AddressLink>
          </CenteredFormHelperText>
        </DataContainer>
        <DataContainer>
          <Title>Collateral Amount</Title>
          <FormControl>
            <InputLabel>Collateral token amount</InputLabel>
            <Input
              disabled
              style={{ color: `rgba(0, 0, 0, 0.87)` }}
              value={collateralTokenAmount}
              endAdornment={
                <InputAdornment position="end">
                  {getSymbol(tokens, collateralTokenAddress)}
                </InputAdornment>
              }
            />
            <FormHelperTextWithDetail component="div">
              <Tooltip
                title={
                  <div style={{ maxWidth: `300px` }}>
                    This shows an estimated minimum amount of collateral token
                    required to satify the initial margin amount, based on
                    current token prices provided by the chosen oracle. The
                    actual amount will be calculated when the loan order is
                    taken, and the trader must have at least this amount in
                    their wallet to open the loan. It is advised to have at
                    least 10% more than this, to protect for price fluctuations.
                  </div>
                }
              >
                <MoreInfo>More Info</MoreInfo>
              </Tooltip>
              <RightJustified>
                <AddressLink href="" onClick={collateralRefresh}>
                  Refresh
                </AddressLink>
              </RightJustified>
            </FormHelperTextWithDetail>
            <FormHelperTextWithDetail component="div">
              <Tooltip
                title={
                  <div style={{ maxWidth: `300px` }}>
                    Set this option if you wish to withdraw the loan to your wallet. 
                    An amount of collateral equal to the Initial Margin Amount + 
                    the total value of your loan, will be escrowed. Please ensure you 
                    have enough collateral token balance and that you know what you are 
                    doing. After filling the order, the loan token will immediately be 
                    withdrawn to your wallet. If you don't return the full amount of loan
                    token before the loan term ends or the loan gets liquidated, you will 
                    lose a large portion of the collateral in order to compensate the lender 
                    for the full value of the loan.
                  </div>
                }
              >
                <FormControlLabel
                  control={
                    <Checkbox checked={overCollateralize} onChange={setOverCollateralize} />
                  }
                  label="Withdraw Loan"
                />
              </Tooltip>
            </FormHelperTextWithDetail>
          </FormControl>
        </DataContainer>
      </Container>
    </Fragment>
  );
};
