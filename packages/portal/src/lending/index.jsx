import styled from "styled-components";
import MuiButton from "@material-ui/core/Button";
import { Dialog, DialogContent } from "@material-ui/core";
import Section, { SectionLabel } from "../common/FormSection";
import LoanItem from "./LoanItem";

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
  state = { loans: [], loading: false, count: 10, showDialog: false };

  componentDidMount() {
    this.getLoans();
  }

  getLoans = async () => {
    const { bZx, accounts } = this.props;
    this.setState({ loading: true });
    try {
      const loans = await this.wrapAndRun(bZx.getLoansForLender({
        address: accounts[0],
        count: this.state.count,
        activeOnly: false
      }));
      console.log(loans);
      this.setState({ loans, loading: false, error: false });
    } catch(e) {
      console.log(e);
      this.setState({ error: true, loading: false, loans: [] });
    }
  };

  increaseCount = () => {
    this.setState(p => ({ count: p.count + 10 }), this.getLoans);
  };

  openDialog = () => this.setState({ showDialog: true });
  closeDialog = () => this.setState({ showDialog: false });

  render() {
    const { bZx, tokens, accounts, web3 } = this.props;
    const { loans, loading, error, count, showDialog } = this.state;
    const openLoans = loans.filter(p => p.active === 1);
    const closedLoans = loans.filter(p => p.active === 0);
    const currentFee = 0.1; // will likely change in the future
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
          <SectionLabel>Open Loans ({openLoans.length})
          {/* openLoans.length > 0 ? (
            <div style={{ marginLeft: `-6px`, marginTop: `-16px` }}>
              <br/>
              <Button
              onClick={this.openDialog}
              variant="raised"
              color="primary"
              >
                Withdraw All Interest
              </Button>
              <Dialog open={showDialog} onClose={this.closeDialog}>
                <DialogContent>
                  <SectionLabel>Withdraw Interest From All Loans</SectionLabel>
                  <p>
                    Currently, we are taking a fee of
                    {` `}
                    <strong>{currentFee * 100}%</strong> to insure the loans.
                  </p>
                  <p>Please note that the fee might change in the future.</p>
                  <Button
                    onClick={this.withdrawInterest}
                    variant="raised"
                    color="primary"
                  >
                    Withdraw All Interest
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          ) : `` */}
          </SectionLabel>
          {openLoans.map(data => {
            data.ts = Date.now();
            return (
            <LoanItem
              key={data.loanOrderHash + data.trader + data.loanStartUnixTimestampSec}
              bZx={bZx}
              tokens={tokens}
              accounts={accounts}
              data={data}
              web3={web3}
              currentFee={currentFee}
            />
          )})}
        </Section>
        <Section>
          <SectionLabel>Closed Loans ({closedLoans.length})</SectionLabel>
          {closedLoans.map(data => (
            <LoanItem
              key={data.loanOrderHash + data.trader + data.loanStartUnixTimestampSec}
              bZx={bZx}
              tokens={tokens}
              accounts={accounts}
              data={data}
              web3={web3}
            />
          ))}
          {closedLoans.length === 0 && `None`}
        </Section>
      </div>
    );
  }
}
