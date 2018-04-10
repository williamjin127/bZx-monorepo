import { Fragment } from "react";
import styled from "styled-components";
import Tooltip from "material-ui/Tooltip";
import { getIconURL } from "../../common/tokens";

const Container = styled.div`
  display: flex;
  width: 100%;
  padding: 24px 0;
  justify-content: center;
  align-items: flex-start;
`;

const TokenContainer = styled.div`
  width: 180px;
  text-align: center;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
`;

const Title = styled.div`
  margin-bottom: 24px !important;
  color: rgba(0, 0, 0, 0.54);
  padding: 0;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
`;

const CoinIcon = styled.img`
  width: 32px;
  margin-top: 6px;
`;

const CoinInfo = styled.a.attrs({
  target: `_blank`,
  rel: `noopener noreferrer`
})`
  text-decoration: none;
`;

const CoinLabel = styled.div`
  margin-top: 12px;

  color: rgba(0, 0, 0, 0.54);
  padding: 0;
  font-size: 12px;
`;

const CoinAmount = styled.div`
  margin-top: 12px;
`;

const TooltipText = styled.div`
  font-family: monospace;
  font-size: 12px;
`;

export default ({
  tokens,
  role,
  loanTokenAddress,
  loanTokenAmount,
  interestTokenAddress,
  interestAmount,
  collateralTokenAddress
}) => {
  const getTokenInfo = address => tokens.filter(t => t.address === address)[0];
  const loanToken = getTokenInfo(loanTokenAddress);
  const interestToken = getTokenInfo(interestTokenAddress);
  const collateralToken = getTokenInfo(collateralTokenAddress);
  return (
    <Fragment>
      <Container>
        <TokenContainer>
          <Tooltip title="This is the total amount being loaned or borrowed.">
            <Title>Loan Token</Title>
          </Tooltip>
          <CoinInfo
            href={`https://ropsten.etherscan.io/token/${loanToken.address}`}
          >
            <CoinIcon src={getIconURL(loanToken)} />
            <CoinLabel>{loanToken.name}</CoinLabel>
          </CoinInfo>
          <Tooltip title={<TooltipText>{loanToken.address}</TooltipText>}>
            <CoinAmount>
              {loanTokenAmount} {loanToken.symbol}
            </CoinAmount>
          </Tooltip>
        </TokenContainer>
        <TokenContainer>
          <Tooltip title="This is the interest amount, paid per day by the borrower.">
            <Title>Interest Token</Title>
          </Tooltip>
          <CoinInfo
            href={`https://ropsten.etherscan.io/token/${interestToken.address}`}
          >
            <CoinIcon src={getIconURL(interestToken)} />
            <CoinLabel>{interestToken.name}</CoinLabel>
          </CoinInfo>
          <Tooltip title={<TooltipText>{interestToken.address}</TooltipText>}>
            <CoinAmount>
              {interestAmount} {interestToken.symbol}
            </CoinAmount>
          </Tooltip>
        </TokenContainer>
        {role === `trader` && (
          <TokenContainer>
            <Tooltip
              title={
                <div style={{ maxWidth: `240px` }}>
                  This token amount will be calculated when the order is filled
                  (either partially or fully). It will be set to the amount
                  needed to satisfy the initial margin amount to cover the
                  amount of loan token borrowed.
                </div>
              }
            >
              <Title>Collateral Token</Title>
            </Tooltip>
            <CoinInfo
              href={`https://ropsten.etherscan.io/token/${
                collateralToken.address
              }`}
            >
              <CoinIcon src={getIconURL(collateralToken)} />
              <CoinLabel>{collateralToken.name}</CoinLabel>
            </CoinInfo>
          </TokenContainer>
        )}
      </Container>
    </Fragment>
  );
};
