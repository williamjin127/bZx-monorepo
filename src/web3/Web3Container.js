/* global window */
import styled from "styled-components";
import { ZeroEx } from "0x.js";
import B0xJS from "b0x.js"; // eslint-disable-line
import getWeb3 from "./getWeb3";
import GetMetaMask from "./GetMetaMask";
import getNetworkId from "./getNetworkId";

const LoadingContainer = styled.div`
  background: white;
  width: 100%;
  height: 100%;

  display: flex;
  flex-direction: column;
  jsutify-content: center;
  align-items; center;
`;

export default class Web3Container extends React.Component {
  state = {
    loading: true,
    errorMsg: ``,
    web3: null,
    zeroEx: null,
    tokens: null,
    b0x: null,
    accounts: null,
    oracles: null,
    networkId: null
  };

  async componentDidMount() {
    const web3 = await getWeb3();
    if (!web3) {
      this.setState({ loading: false, errorMsg: `` });
      return;
    }
    const networkId = await getNetworkId(web3);

    // Known networks we actively support should be set here.
    // Currently only Ropsten is supported.
    const activeNetworkIds = {
      3: `Ropsten Test Network`
    };

    const displayNetworkError = () => {
      if (activeNetworkIds[networkId]) {
        this.setState({
          loading: false,
          errorMsg: `We are temporarily unable to connect to ${
            activeNetworkIds[networkId]
          }. Please try again later.`
        });
      } else {
        this.setState({
          loading: false,
          errorMsg: `You may be on the wrong network. Please check that MetaMask is set to Ropsten Test Network.`
        });
      }
    };

    const b0x = new B0xJS(web3.currentProvider, { networkId });
    const zeroEx = new ZeroEx(web3.currentProvider, {
      networkId,
      tokenRegistryContractAddress: b0x.addresses.TokenRegistry
    });

    // Get accounts
    const accounts = await web3.eth.getAccounts();
    if (!accounts[0]) {
      // alert(`Please unlock your MetaMask account, and then refresh the page.`);
      this.setState({
        loading: false,
        errorMsg: `Please unlock your MetaMask account.`
      });
      setInterval(async () => {
        if ((await web3.eth.getAccounts())[0]) {
          window.location.reload();
        }
      }, 500);

      return;
    }

    // Watch for account change
    const account = accounts[0];
    setInterval(async () => {
      if ((await web3.eth.getAccounts())[0] !== account) {
        window.location.reload();
      }
    }, 500);

    // Get oracles
    let oracles;
    try {
      oracles = await b0x.getOracleList();
      if (oracles.length === 0) {
        displayNetworkError();
        return;
      }
    } catch (err) {
      /* alert(
        `You may be on the wrong network. Please check that MetaMask is set to Ropsten Test Network.`
      ); */
      console.error(err);
      displayNetworkError();
      return;
    }

    // Get tokens from the token registry
    let tokens;
    try {
      tokens = await b0x.getTokenList();
      if (tokens.length === 0) {
        displayNetworkError();
        return;
      }
    } catch (err) {
      /* alert(
        `You may be on the wrong network. Please check that MetaMask is set to Ropsten Test Network.`
      ); */
      console.error(err);
      displayNetworkError();
      return;
    }

    this.setState({
      loading: false,
      errorMsg: ``,
      web3,
      zeroEx,
      tokens,
      b0x,
      accounts,
      oracles,
      networkId
    });
  }

  render() {
    const {
      loading,
      errorMsg,
      web3,
      zeroEx,
      tokens,
      b0x,
      accounts,
      oracles,
      networkId
    } = this.state;
    const { render } = this.props;
    if (loading) {
      return <LoadingContainer>Loading Web3...</LoadingContainer>;
    } else if (errorMsg) {
      return <LoadingContainer>{errorMsg}</LoadingContainer>;
    }
    return web3 ? (
      render({ web3, zeroEx, tokens, b0x, accounts, oracles, networkId })
    ) : (
      <GetMetaMask />
    );
  }
}
