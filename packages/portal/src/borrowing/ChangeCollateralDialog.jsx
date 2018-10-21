import styled from "styled-components";
import { Dialog, DialogTitle, DialogContent } from "@material-ui/core";
import Button from "@material-ui/core/Button";
import TokenPicker from "../common/TokenPicker";
import Section, { SectionLabel, Divider } from "../common/FormSection";

const TxHashLink = styled.a.attrs({
  target: `_blank`,
  rel: `noopener noreferrer`
})`
  font-family: monospace;
  display: block;
  text-overflow: ellipsis;
  overflow: auto;
`;

const defaultToken = tokens => {
  let token = tokens.filter(t => t.symbol === `DAI`);
  if (token.length > 0) {
    token = token[0]; // eslint-disable-line prefer-destructuring
  } else {
    token = tokens[0]; // eslint-disable-line prefer-destructuring
  }
  return token;
};

export default class ChangeCollateralDialog extends React.Component {
  state = {
    tokenAddress: defaultToken(this.props.tokens).address,
    approvalLoading: false,
    tokenApproved: false
  };

  componentDidMount = async () => {
    this.checkAllowance();
  };

  setTokenAddress = tokenAddress => {
    this.setState({ tokenAddress }, () => {
      this.checkAllowance();
    });
  };

  checkAllowance = async () => {
    const { tokenAddress } = this.state;
    const { bZx, accounts, tokens } = this.props;
    const token = tokens.filter(t => t.address === tokenAddress)[0];
    console.log(`checking allowance`);
    console.log(token.name, token.address);
    const allowance = await bZx.getAllowance({
      tokenAddress: token.address,
      ownerAddress: accounts[0].toLowerCase()
    });
    console.log(`Allowance:`, allowance.toNumber());
    this.setState({
      tokenApproved: allowance.toNumber() !== 0,
      approvalLoading: false
    });
  };

  approveToken = async () => {
    const { tokenAddress } = this.state;
    const { bZx, tokens, web3, accounts } = this.props;
    const token = tokens.filter(t => t.address === tokenAddress)[0];
    console.log(`approving allowance`);
    console.log(token.name, token.address);
    this.setState({ approvalLoading: true });

    if (bZx.portalProviderName !== `MetaMask`) {
      alert(`Please confirm this transaction on your device.`);
    }

    const txOpts = {
      from: accounts[0],
      gas: 2000000,
      gasPrice: window.defaultGasPrice.toString()
    };

    const txObj = await bZx.setAllowanceUnlimited({
      tokenAddress: token.address,
      ownerAddress: accounts[0].toLowerCase(),
      getObject: true,
      txOpts
    });

    try {
      await txObj
        .estimateGas(txOpts)
        .then(gas => {
          console.log(gas);
          txOpts.gas = window.gasValue(gas);
          txObj
            .send(txOpts)
            .once(`transactionHash`, hash => {
              alert(`Transaction submitted, transaction hash:`, {
                component: () => (
                  <TxHashLink href={`${bZx.etherscanURL}tx/${hash}`}>
                    {hash}
                  </TxHashLink>
                )
              });
            })
            .then(() => {
              alert(`Your token is approved.`);
              this.checkAllowance();
            })
            .catch(error => {
              console.error(error.message);
              if (
                error.message.includes(`denied transaction signature`) ||
                error.message.includes(`Condition of use not satisfied`) ||
                error.message.includes(`Invalid status`)
              ) {
                alert();
              } else {
                alert(`The transaction is failing. Please try again later.`);
              }
            });
        })
        .catch(error => {
          console.error(error.message);
          if (
            error.message.includes(`denied transaction signature`) ||
            error.message.includes(`Condition of use not satisfied`) ||
            error.message.includes(`Invalid status`)
          ) {
            alert();
          } else {
            alert(`The transaction is failing. Please try again later.`);
          }
        });
    } catch (error) {
      console.error(error.message);
      if (
        error.message.includes(`denied transaction signature`) ||
        error.message.includes(`Condition of use not satisfied`) ||
        error.message.includes(`Invalid status`)
      ) {
        alert();
      } else {
        alert(`The transaction is failing. Please try again later.`);
      }
    }
  };

  executeChange = async () => {
    const { bZx, web3, accounts, loanOrderHash } = this.props;
    const { tokenAddress } = this.state;
    const txOpts = {
      from: accounts[0],
      gas: 1000000,
      gasPrice: window.defaultGasPrice.toString()
    };

    console.log(`Executing change:`);
    console.log({
      loanOrderHash,
      collateralTokenFilled: tokenAddress,
      txOpts
    });
    if (bZx.portalProviderName !== `MetaMask`) {
      alert(`Please confirm this transaction on your device.`);
    }

    const txObj = await bZx.changeCollateral({
      loanOrderHash,
      collateralTokenFilled: tokenAddress,
      getObject: true,
      txOpts
    });

    try {
      await txObj
        .estimateGas(txOpts)
        .then(gas => {
          console.log(gas);
          txOpts.gas = window.gasValue(gas);
          txObj
            .send(txOpts)
            .once(`transactionHash`, hash => {
              alert(`Transaction submitted, transaction hash:`, {
                component: () => (
                  <TxHashLink href={`${bZx.etherscanURL}tx/${hash}`}>
                    {hash}
                  </TxHashLink>
                )
              });
            })
            .then(() => {
              alert(`Execution complete.`);
              this.props.onClose();
            })
            .catch(error => {
              console.error(error);
              alert(
                `We were not able to execute your transaction. Please check that you have sufficient tokens.`
              );
              this.props.onClose();
            });
        })
        .catch(error => {
          console.error(error);
          alert(`The transaction is failing. Please try again later.`);
          this.props.onClose();
        });
    } catch (error) {
      console.error(error);
      alert(`The transaction is failing. Please try again later.`);
      this.props.onClose();
    }
  };

  render() {
    const { approvalLoading, tokenApproved } = this.state;
    return (
      <Dialog open={this.props.open} onClose={this.props.onClose}>
        <DialogTitle>Change Collateral</DialogTitle>
        <DialogContent>
          <Section>
            <SectionLabel>1. Choose your new collateral token</SectionLabel>
            <TokenPicker
              tokens={this.props.tokens}
              setAddress={this.setTokenAddress}
              value={this.state.tokenAddress}
            />
          </Section>
          <Divider />
          <Section>
            <SectionLabel>2. Approve the token</SectionLabel>
            {approvalLoading ? (
              <Button variant="raised" disabled>
                Approving...
              </Button>
            ) : (
              <Button
                variant="raised"
                onClick={this.approveToken}
                disabled={tokenApproved}
              >
                {tokenApproved ? `Token Approved` : `Approve Token`}
              </Button>
            )}
          </Section>
          <Divider />
          <Section>
            <SectionLabel>3. Execute the change</SectionLabel>
            <p>
              When you click the button below, we will attempt to transfer an
              amount equal to the required initial margin amount for the loan.
              Your old collateral token will automatically be refunded to your
              account.
            </p>
            <Button
              onClick={this.executeChange}
              variant="raised"
              color="primary"
              disabled={!tokenApproved}
            >
              Execute change
            </Button>
          </Section>
        </DialogContent>
      </Dialog>
    );
  }
}
