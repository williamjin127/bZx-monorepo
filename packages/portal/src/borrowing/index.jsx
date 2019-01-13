import styled from "styled-components";
import MuiButton from "@material-ui/core/Button";

import Section, { SectionLabel } from "../common/FormSection";
import OpenedLoan from "./OpenLoanItem";
import ClosedLoan from "./ClosedLoanItem";

import BZxComponent from "../common/BZxComponent";

const InfoContainer = styled.div`
  display: flex;
  align-items: center;
`;

const ShowCount = styled.div`
  display: inline-block;
  margin: 6px;
`;

const Button = styled(MuiButton)`
  margin: 6px !important;
`;

export default class Borrowing extends BZxComponent {
  state = { loans: [], loading: false, error: false, count: 10 };

  componentDidMount() {
    this.getLoans();
  }

  getLoans = async () => {
    const { bZx, accounts } = this.props;
    this.setState({ loading: true });
    try {
      const loans = await this.wrapAndRun(bZx.getLoansForTrader({
        address: accounts[0],
        count: this.state.count,
        activeOnly: false
      }));
      console.log(`loans`,loans);
      this.setState({ loans, loading: false, error: false });
    } catch(e) {
      console.log(e);
      this.setState({ error: true, loading: false, loans: [] });
    }
  };

  increaseCount = () => {
    this.setState(p => ({ count: p.count + 10 }), this.getLoans);
  };

  render() {
    const { bZx, tokens, accounts, web3 } = this.props;
    const { loans, loading, error, count } = this.state;
    const openLoans = loans.filter(p => p.active === 1);
    const closedLoans = loans.filter(p => p.active === 0);
    if (error) {
      return (
        <div>
          <InfoContainer>
            <ShowCount>Web3 error loading loans. Please refresh in a few minutes.</ShowCount>
            <Button onClick={this.getLoans} variant="raised" disabled={false}>
              Refresh
            </Button>
          </InfoContainer>
        </div>
      );
    } else if (loans.length === 0) {
      return (
        <div>
          <InfoContainer>
            <ShowCount>No loans found.</ShowCount>
            <Button onClick={this.getLoans} variant="raised" disabled={loading}>
              {loading ? `Refreshing...` : `Refresh`}
            </Button>
          </InfoContainer>
        </div>
      );
    }
    return (
      <div>
        <InfoContainer>
          <ShowCount>
            Showing last {count} loans ({loans.length} loans found).
          </ShowCount>
          <Button onClick={this.increaseCount} variant="raised" color="primary">
            Show more
          </Button>
          <Button onClick={this.getLoans} variant="raised" disabled={loading}>
            {loading ? `Refreshing...` : `Refresh`}
          </Button>
        </InfoContainer>
        <br />
        <Section>
          <SectionLabel>Open Loans ({openLoans.length})</SectionLabel>
          {openLoans.map(data => (
            <OpenedLoan
              key={data.loanOrderHash + data.trader + data.loanStartUnixTimestampSec}
              bZx={bZx}
              tokens={tokens}
              accounts={accounts}
              data={data}
              web3={web3}
            />
          ))}
        </Section>
        <Section>
          <SectionLabel>Closed Loans ({closedLoans.length})</SectionLabel>
          {closedLoans.map(data => (
            <ClosedLoan
              key={data.loanOrderHash + data.trader + data.loanStartUnixTimestampSec}
              bZx={bZx}
              tokens={tokens}
              accounts={accounts}
              data={data}
            />
          ))}
          {closedLoans.length === 0 && `None`}
        </Section>
      </div>
    );
  }
}
