/* globals document */
import { Fragment } from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";
import packageJson from "../../package.json";

const AddressLink = styled.a.attrs({
  target: `_blank`,
  rel: `noopener noreferrer`
})`
  color: white;
  display: inline-block;
  margin-bottom: 3px;
`;

const networks = {
  1: { name: `Mainnet`, color: `#038789` },
  3: { name: `Ropsten`, color: `#E91550` },
  4: { name: `Rinkeby`, color: `#EBB33F` },
  42: { name: `Kovan`, color: `#690496` }
};

const currentAccount = addr => `${addr.substr(0, 8)} ... ${addr.substr(-6)}`;

const NetworkIndicator = ({ networkId, accounts, etherscanURL }) => {
  // eslint-disable-next-line no-prototype-builtins
  const nameExists = networks.hasOwnProperty(networkId);
  const domNode = document.getElementsByClassName(`network-indicator`)[0];

  const addressLink = `${etherscanURL}address/${accounts[0]}`;
  const addressText = currentAccount(accounts[0]);
  let ToRender;
  if (nameExists) {
    ToRender = (
      <Fragment>
        <div className="network-name">{networks[networkId].name}</div>
        <AddressLink href={addressLink}>{addressText}</AddressLink>
        <div className="portal-version">Alpha v{packageJson.version}</div>
      </Fragment>
    );
  } else {
    ToRender = (
      <Fragment>
        <div className="network">Custom Network: {networkId}</div>
        <div className="portal-version">Alpha v{packageJson.version}</div>
      </Fragment>
    );
  }
  return ReactDOM.createPortal(ToRender, domNode);
};

export default NetworkIndicator;
