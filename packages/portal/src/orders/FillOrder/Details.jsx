import { Fragment } from "react";
import styled from "styled-components";
import { fromBigNumber } from "../../common/utils";

const Container = styled.div`
  display: flex;
  width: 100%;
  text-align: center;
  padding: 24px 0;
  justify-content: center;
  align-items: center;
  flex-direction: column;
`;

const DataContainer = styled.div`
  display: flex;
`;

const Title = styled.div`
  margin-right: 12px;
  margin-bottom: 12px !important;
  color: rgba(0, 0, 0, 0.54);
  padding: 0;
  font-size: 1rem;
  line-height: 1;
`;

const Hash = styled.a`
  display: inline-block;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 20ch;
  vertical-align: middle;
`;

export default ({
  bZx,
  oracles,
  initialMarginAmount,
  maintenanceMarginAmount,
  oracleAddress,
  feeRecipientAddress,
  lenderRelayFee,
  traderRelayFee
}) => {
  const oracle = oracles.filter(o => o.address === oracleAddress)[0];
  const useRelay =
    feeRecipientAddress !== `0x0000000000000000000000000000000000000000`;
  return (
    <Fragment>
      <Container>
        <DataContainer>
          <Title>Initial Margin Amount</Title>
          <div>{fromBigNumber(initialMarginAmount, 1e18)}%</div>
        </DataContainer>
        <DataContainer>
          <Title>Maintenance Margin Amount</Title>
          <div>{fromBigNumber(maintenanceMarginAmount, 1e18)}%</div>
        </DataContainer>
        <DataContainer>
          <Title>Oracle</Title>
          <div>
            {oracle ? (
              <Fragment>
                {oracle.name} (
                <Hash
                  href={`${bZx.etherscanURL}address/${oracle.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {oracle.address}
                </Hash>
                )
              </Fragment>
            ) : (
              <Fragment>INVALID</Fragment>
            )}
          </div>
        </DataContainer>
        {useRelay && (
          <Fragment>
            <DataContainer>
              <Title>Relay/Exchange address</Title>
              <Hash
                href={`${bZx.etherscanURL}address/${feeRecipientAddress}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {feeRecipientAddress}
              </Hash>
            </DataContainer>
            <DataContainer>
              <Title>Lender Relay Fee</Title>
              <div>{lenderRelayFee} BZRX</div>
            </DataContainer>
            <DataContainer>
              <Title>Trader Relay Fee</Title>
              <div>{traderRelayFee} BZRX</div>
            </DataContainer>
          </Fragment>
        )}
      </Container>
    </Fragment>
  );
};
