import styled from "styled-components";
import Tooltip from "@material-ui/core/Tooltip";
import Input from "@material-ui/core/Input";
import InputLabel from "@material-ui/core/InputLabel";
import InputAdornment from "@material-ui/core/InputAdornment";
import FormControl from "@material-ui/core/FormControl";
import FormHelperText from "@material-ui/core/FormHelperText";

import TokenPicker from "../../common/TokenPicker";
import Section, { SectionLabel } from "../../common/FormSection";
import { getSymbol } from "../../common/tokens";

const Content = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
`;

const TokenGroup = styled.div`
  width: 240px;
  margin: 24px;
  text-align: center;
`;

// TODO - clean up these styles
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

const RightJustifiedText = styled.span`
  font-weight: bold;
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
  tokens,
  role,
  // state setters
  setStateForAddress,
  setStateForInput,
  setStateForInterestRate,
  // address states
  loanTokenAddress,
  interestTokenAddress,
  collateralTokenAddress,
  // amount states
  loanTokenAmount,
  collateralTokenAmount,
  interestRate,
  interestTotalAmount,
  collateralRefresh,
  etherscanURL,
  interestRefresh
}) => (
  <Section>
    <SectionLabel>Tokens and Token Amounts</SectionLabel>
    <Content>
      <TokenGroup>
        <Title>Loan Token</Title>
        <TokenPicker
          tokens={tokens}
          setAddress={setStateForAddress(`loanTokenAddress`)}
          value={loanTokenAddress}
        />
        <CenteredFormHelperText component="div">
          <AddressLink href={`${etherscanURL}address/${loanTokenAddress}`}>
            Etherscan
          </AddressLink>
        </CenteredFormHelperText>
        <FormControl fullWidth>
          <InputLabel>Loan token amount</InputLabel>
          <Input
            value={loanTokenAmount}
            type="number"
            onChange={setStateForInput(`loanTokenAmount`)}
            endAdornment={
              <InputAdornment position="end">
                {getSymbol(tokens, loanTokenAddress)}
              </InputAdornment>
            }
          />
          <FormHelperText component="div">
            <Tooltip
              title={
                <div style={{ maxWidth: `300px` }}>
                  {role === `trader`
                    ? `This sets the amount to be borrowed.`
                    : `This sets the total amount that can be loaned to one or more traders.`}
                </div>
              }
            >
              <MoreInfo>More Info</MoreInfo>
            </Tooltip>
          </FormHelperText>
        </FormControl>
      </TokenGroup>

      <TokenGroup>
        <Title>Interest Token</Title>
        <TokenPicker
          tokens={tokens}
          setAddress={setStateForAddress(`interestTokenAddress`)}
          value={interestTokenAddress}
        />
        <CenteredFormHelperText component="div">
          <AddressLink href={`${etherscanURL}address/${interestTokenAddress}`}>
            Etherscan
          </AddressLink>
        </CenteredFormHelperText>
        <FormControl fullWidth>
          <InputLabel>Interest rate (per day)</InputLabel>
          <Input
            value={Math.round(interestRate * 10000) / 100}
            type="number"
            onChange={setStateForInterestRate}
            endAdornment={<InputAdornment position="end">%</InputAdornment>}
          />
          <FormHelperTextWithDetail component="div">
            <Tooltip
              title={
                <div style={{ maxWidth: `300px` }}>
                  This sets the interest paid per day and shows the total
                  interest paid out if the loan were to run from now until
                  expiration. The amount paid out will be less, based on the
                  actual amount borrowed and if the loan is closed early by the
                  trader or is liquidated.
                  <br />
                  <br />
                  If the total amount shows zero, it&apos;s possible this loan
                  and interest token pair is not supported, or your loan token
                  amount is too small or too large for the loan.
                </div>
              }
            >
              <MoreInfo>More Info</MoreInfo>
            </Tooltip>
            <RightJustified>
              <RightJustifiedText>
                {interestTotalAmount} {getSymbol(tokens, interestTokenAddress)}
              </RightJustifiedText>
              <br />
              <AddressLink href="" onClick={interestRefresh}>
                Refresh
              </AddressLink>
            </RightJustified>
          </FormHelperTextWithDetail>
        </FormControl>
      </TokenGroup>

      {role === `trader` && (
        <TokenGroup>
          <Title>Collateral Token</Title>
          <TokenPicker
            tokens={tokens}
            setAddress={setStateForAddress(`collateralTokenAddress`)}
            value={collateralTokenAddress}
          />
          <CenteredFormHelperText component="div">
            <AddressLink
              href={`${etherscanURL}address/${collateralTokenAddress}`}
            >
              Etherscan
            </AddressLink>
          </CenteredFormHelperText>
          <FormControl fullWidth>
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
          </FormControl>
        </TokenGroup>
      )}
    </Content>
  </Section>
);
