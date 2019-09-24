import { Fragment } from "react";
import styled from "styled-components";
import MuiButton from "@material-ui/core/Button";
import BZxComponent from "../common/BZxComponent";
import { Divider } from "../common/FormSection";
import { COLORS } from "../styles/constants";
import { fromBigNumber, toBigNumber } from "../common/utils";
import { TextField, Input, InputLabel, InputAdornment, FormControl, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@material-ui/core";

const IsSaleLive = true;

const InfoContainer = styled.div`
  display: flex;
  align-items: center;
`;

const ShowInfo = styled.div`
  display: inline-block;
  margin: 6px;
`;

const Button = styled(MuiButton)`
  margin: 6px !important;
`;

const DataPointContainer = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 6px;
`;

const DataPoint = styled.span`
  margin-left: 16px;
`;

const Label = styled.span`
  font-weight: 600;
  color: ${COLORS.gray};
`;

const AddressLink = styled.a.attrs({
  target: `_blank`,
  rel: `noopener noreferrer`
})`
  //display: inline-block;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 20ch;
`;

const TxHashLink = styled.a.attrs({
  target: `_blank`,
  rel: `noopener noreferrer`
})`
  font-family: monospace;
  display: block;
  text-overflow: ellipsis;
  overflow: auto;
}
`;

function stringToHex (tmp) {
  if (!tmp)
    return '';
  
  var str = '',
      i = 0,
      tmp_len = tmp.length,
      c;

  for (; i < tmp_len; i += 1) {
      c = tmp.charCodeAt(i);
      str += c.toString(16);
  }
  return str;
}

export default class Debug extends BZxComponent {
  state = { 
    loading: false, 
    error: false,
    bzxContract: null,
    order: null,
    position: null,
    newHash: ``,
    newTrader: ``,
    showLoanDialog: false,
  };

  async componentDidMount() {

    let bzxAddress;

    /** TEMP **/
    bzxAddress = (await this.props.bZx.getWeb3Contract(`BZx`))._address;
    /** TEMP **/

    const bzxContract = await this.props.bZx.getWeb3Contract(`BZx`, bzxAddress);
    console.log(`bzx contract:`, bzxContract._address);

    await this.setState({ 
      bzxContract,
      newHash: this.props.currentHash,
      newTrader: this.props.currentTrader
    });

    await this.refreshLoanData();
  }

  async componentWillReceiveProps(nextProps) {
    console.log(`nextProps`,nextProps);
    if (nextProps.currentHash !== this.props.currentHash || nextProps.currentTrader !== this.props.currentTrader)
      await this.setState({ 
        newHash: this.props.currentHash, 
        newTrader: this.props.currentTrader
      });
      await this.refreshLoanData();
  }

  refreshLoanData = async () => {
    const { web3, accounts } = this.props;
    const { bzxContract, newHash, newTrader } = this.state;

    if (!newHash) {
      return;
    }

    await this.setState({ loading: true });

    //console.log(`Token contract:`, tokenContract._address);
    let orderFilledAmounts, orderCancelledAmounts;
    let lenderInterestForOracle, traderInterestForLoan;

    try {
      let order = {};
      if (newHash) {
        const orderKeys = [
          `loanTokenAddress`,
          `interestTokenAddress`,
          `collateralTokenAddress`,
          `oracleAddress`,
          `loanTokenAmount`,
          `interestAmount`,
          `initialMarginAmount`,
          `maintenanceMarginAmount`,
          `maxDurationUnixTimestampSec`,
          `loanOrderHash`,
        ]
        const orderArr = await this.wrapAndRun(bzxContract.methods.getLoanOrder(newHash).call());

        for(var i=0; i < orderKeys.length; i++) {
          order[orderKeys[i]] = orderArr[i];
        }

        //order[`loanTokenAmount`] = toBigNumber(order[`loanTokenAmount`], 10 ** -18).toString() + ` (normalized)`;
        //order[`interestAmount`] = toBigNumber(order[`interestAmount`], 10 ** -18).toString()+ ` (normalized)`;

        orderFilledAmounts = await this.wrapAndRun(bzxContract.methods.orderFilledAmounts(newHash).call());
        orderCancelledAmounts = await this.wrapAndRun(bzxContract.methods.orderCancelledAmounts(newHash).call());
      }

      let orderAux = {};
      if (newHash) {
        const orderAuxKeys = [
          `makerAddress`,
          `takerAddress`,
          `feeRecipientAddress`,
          `tradeTokenToFillAddress`,
          `lenderRelayFee`,
          `traderRelayFee`,
          `makerRole`,
          `expirationUnixTimestampSec`,
          `withdrawOnOpen`,
          `description`,
        ]
        const orderAuxArr = await this.wrapAndRun(bzxContract.methods.getLoanOrderAux(newHash).call());

        for(var i=0; i < orderAuxKeys.length; i++) {
          orderAux[orderAuxKeys[i]] = orderAuxArr[i];
        }

        //order[`loanTokenAmount`] = toBigNumber(order[`loanTokenAmount`], 10 ** -18).toString() + ` (normalized)`;
        //order[`interestAmount`] = toBigNumber(order[`interestAmount`], 10 ** -18).toString()+ ` (normalized)`;
      }

      let position = {};
      if (newHash && newTrader) {
        const positionKeys = [
          `trader`,
          `collateralTokenAddressFilled`,
          `positionTokenAddressFilled`,
          `loanTokenAmountFilled`,
          `loanTokenAmountUsed`,
          `collateralTokenAmountFilled`,
          `positionTokenAmountFilled`,
          `loanStartUnixTimestampSec`,
          `loanEndUnixTimestampSec`,
          `active`,
          `positionId`,
        ]
        const positionArr = await this.wrapAndRun(bzxContract.methods.getLoanPosition(
          await this.wrapAndRun(bzxContract.methods.loanPositionsIds(newHash, newTrader).call())
        ).call());

        for(var i=0; i < positionKeys.length; i++) {
          position[positionKeys[i]] = positionArr[i];
        }

        //position[`loanTokenAmountFilled`] = toBigNumber(position[`loanTokenAmountFilled`], 10 ** -18).toString()+ ` (normalized)`;
        //position[`collateralTokenAmountFilled`] = toBigNumber(position[`collateralTokenAmountFilled`], 10 ** -18).toString()+ ` (normalized)`;
        //position[`positionTokenAmountFilled`] = toBigNumber(position[`positionTokenAmountFilled`], 10 ** -18).toString()+ ` (normalized)`;
      
      
        const lender = await this.wrapAndRun(bzxContract.methods.orderLender(
          newHash
        ).call());

        lenderInterestForOracle = await this.wrapAndRun(bzxContract.methods.getLenderInterestForOracle(
          lender,
          order[`oracleAddress`],
          order[`interestTokenAddress`]
        ).call());
        lenderInterestForOracle = {
          interestPaid: lenderInterestForOracle[0],//toBigNumber(lenderInterestForOracle[0], 10 ** -18).toString()+ ` (normalized)`,
          interestPaidDate: lenderInterestForOracle[1],
          interestOwedPerDay: lenderInterestForOracle[2],//toBigNumber(lenderInterestForOracle[2], 10 ** -18).toString()+ ` (normalized)`,
          interestUnPaid: lenderInterestForOracle[3],//toBigNumber(lenderInterestForOracle[3], 10 ** -18).toString()+ ` (normalized)`
        };

        traderInterestForLoan = await this.wrapAndRun(bzxContract.methods.getTraderInterestForLoan(
          newHash,
          position[`trader`]
        ).call());
        traderInterestForLoan = {
          interestTokenAddress: traderInterestForLoan[0],
          interestOwedPerDay: traderInterestForLoan[1],//toBigNumber(traderInterestForLoan[1], 10 ** -18).toString()+ ` (normalized)`,
          interestPaidTotal: traderInterestForLoan[2],//toBigNumber(traderInterestForLoan[2], 10 ** -18).toString()+ ` (normalized)`,
          interestDepositTotal: traderInterestForLoan[3],//toBigNumber(traderInterestForLoan[3], 10 ** -18).toString()+ ` (normalized)`,
          interestDepositRemaining: traderInterestForLoan[4],//toBigNumber(traderInterestForLoan[4], 10 ** -18).toString()+ ` (normalized)`
          interestUpdatedDate: (await this.wrapAndRun(bzxContract.methods.traderLoanInterest(position[`positionId`]).call())).interestUpdatedDate,
        };
      }

      await this.setState({ 
        loading: false, 
        error: false,
        order,
        orderAux,
        position,
        orderFilledAmounts,
        orderCancelledAmounts,
        lenderInterestForOracle,
        traderInterestForLoan
      });

    } catch(e) {
      console.log(e);
      this.setState({ 
        error: true, 
        loading: false
      });
    }

  }

  setStateForInput = key => e => this.setState({ [key]: e.target.value });

  toggleHashDialog = async () => {
    await this.setState(p => ({ showLoanDialog: !p.showLoanDialog }));
    if (!this.state.showLoanDialog && (this.state.newHash !== this.props.currentHash || this.state.newTrader !== this.props.currentTrader)) {
      await this.props.setCurrentLoan(this.props.currentHash, this.props.currentTrader);
      await this.refreshLoanData();
    }
  }

  // can only be called by the lender
  payInterestForOracle = async () => {
    const { web3, bZx, accounts } = this.props;
    const { bzxContract, order } = this.state;

    if (!bzxContract || !order)
      return;

    if (bZx.portalProviderName !== `MetaMask`) {
      alert(`Please confirm this transaction on your device.`);
    }

    const txOpts = {
      from: accounts[0],
      gas: 2000000,
      gasPrice: window.defaultGasPrice.toString()
    };

    const txObj = await bzxContract.methods.payInterestForOracle(
      order[`oracleAddress`],
      order[`interestTokenAddress`]
    );
    console.log(txOpts);

    try {
      console.log(txOpts);
      await txObj.send(txOpts)
        .once(`transactionHash`, hash => {
          alert(`Transaction submitted, transaction hash:`, {
            component: () => (
              <TxHashLink href={`${bZx.etherscanURL}tx/${hash}`}>
                {hash}
              </TxHashLink>
            )
          });
          this.setState({ showReduceDialog: false });
        })
        .then(async () => {
          alert(`The txn is complete.`);
        })
        .catch(error => {
          console.error(error.message);
          alert(`The txn did not complete.`);
          this.setState({ showReduceDialog: false });
        });
    } catch (error) {
      console.error(error.message);
      alert(`The txn did not complete.`);
      this.setState({ showReduceDialog: false });
    }
  };

  render() {
    const { 
      loading,
      error,
      order,
      orderAux,
      position,
      orderFilledAmounts,
      orderCancelledAmounts,
      lenderInterestForOracle,
      traderInterestForLoan
    } = this.state;
    const { bZx, currentHash, currentTrader } = this.props; 
    if (error) {
      return (
        <div>
          <InfoContainer>
            <ShowInfo>Web3 error loading. Please refresh in a few minutes.</ShowInfo>
            <Button onClick={this.refreshLoanData} variant="raised" disabled={false}>
              Refresh
            </Button>
          </InfoContainer>
        </div>
      );
    }

    return (
      <div>

        {bZx.networkId === 50 ? ( <Fragment>
            <p>
              concert load couple harbor equip island argue ramp clarify fence smart topic
            </p>
            <Divider />
        </Fragment> ) : ``}

        <InfoContainer style={{ display: `block` }}>
          <DataPointContainer>
            <Button
              variant="raised"
              color="primary"
              onClick={this.toggleHashDialog}
              style={{ marginLeft: `12px` }}
            >
              Update Loan
            </Button>
            { currentHash ? ( <Button
              onClick={this.refreshLoanData}
              variant="raised"
              disabled={loading}
            >
              {loading ? `Refreshing...` : `Refresh`}
            </Button> ) : ``}
          </DataPointContainer>
          { currentHash ? ( <DataPointContainer>
            <Label>currentHash</Label>
            <DataPoint>
              {currentHash}
            </DataPoint>
          </DataPointContainer> ) : `` }
        </InfoContainer>
        <br/>

        {lenderInterestForOracle ? (
        <Fragment>
          <DataPointContainer>
            <Button
              variant="raised"
              color="primary"
              onClick={this.payInterestForOracle}
              style={{ marginLeft: `12px` }}
            >
              Pay Interest For Oracle
            </Button>
          </DataPointContainer>

          <DataPointContainer>
            <Label>Lender Interest For Oracle</Label>
            <DataPoint>
              <pre>{JSON.stringify(lenderInterestForOracle, null, '  ')}</pre>
            </DataPoint>
          </DataPointContainer>
        </Fragment> ) : ``}

        {traderInterestForLoan ? (
        <DataPointContainer>
          <Label>Trader Interest For Loan</Label>
          <DataPoint>
            <pre>{JSON.stringify(traderInterestForLoan, null, '  ')}</pre>
          </DataPoint>
        </DataPointContainer>) : ``}

        <br/>

        <InfoContainer>
          <ShowInfo>

            <DataPointContainer>

              {this.state.orderFilledAmounts && this.state.orderCancelledAmounts ? (
                <Fragment>
                  <pre>
                    {JSON.stringify({ 
                      "orderFilledAmount": toBigNumber(
                        orderFilledAmounts,
                        10 ** 0//10 ** -18
                      ).toString(),//+` (normalized)`,
                      "orderCancelledAmount": toBigNumber(
                        orderCancelledAmounts,
                        10 ** 0//10 ** -18
                      ).toString()//+` (normalized)`
                    }, null, '  ')}
                  </pre>
                </Fragment>
              ) : ``}
              
            </DataPointContainer>

            <DataPointContainer>

              {this.state.order ? (
                <Fragment>
                  <pre>
                    {JSON.stringify(order, null, '  ')}
                  </pre>
                </Fragment>
              ) : ``}
              
            </DataPointContainer>

            <DataPointContainer>

              {this.state.orderAux ? (
                <Fragment>
                  <pre>
                    {JSON.stringify(orderAux, null, '  ')}
                  </pre>
                </Fragment>
              ) : ``}
              
            </DataPointContainer>

            <DataPointContainer>

              {this.state.position ? (
                <Fragment>
                  <pre>
                    {JSON.stringify(position, null, '  ')}
                  </pre>
                </Fragment>
              ) : ``}
            
            </DataPointContainer>

          </ShowInfo>
        </InfoContainer>
        <Dialog
          open={this.state.showLoanDialog}
          onClose={this.toggleHashDialog}
        >
          <DialogTitle>Loan Selection</DialogTitle>
          <DialogContent>
            <DialogContentText>
            </DialogContentText>
            <br/>
            <FormControl fullWidth>
              <InputLabel>currentHash</InputLabel>
              <Input
                value={this.state.newHash}
                //type="number"
                onChange={this.setStateForInput(`newHash`)}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Trader Address</InputLabel>
              <Input
                value={this.state.newTrader}
                //type="number"
                onChange={this.setStateForInput(`newTrader`)}
              />
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.toggleHashDialog}>OK</Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }
}
