import { Fragment } from "react";
import Layout from "../src/common/Layout";
import {
  Card,
  Header,
  HeaderTitle,
  HeaderData,
  Content
} from "../src/common/MainContent";
import { Divider } from "../src/common/FormSection";
import PageContent from "../src/lending";
import Web3Container from "../src/web3/Web3Container";
import NetworkIndicator from "../src/common/NetworkIndicator";

export default class Lending extends React.Component {
  state = { activeTab: undefined };

  changeTab = tabId => this.setState({ activeTab: tabId });

  render() {
    const { activeTab } = this.state; // eslint-disable-line no-unused-vars
    return (
      <Layout>
        <Card>
          <Header>
            <HeaderTitle>Lending</HeaderTitle>
            <HeaderData />
          </Header>
          <Content>
            <Web3Container
              render={({ web3, zeroEx, tokens, b0x, accounts, networkId }) => (
                <Fragment>
                  <NetworkIndicator
                    networkId={networkId}
                    accounts={accounts}
                    etherscanURL={b0x.etherscanURL}
                  />
                  <p>Manage active loans and view past loans.</p>
                  <Divider />
                  <PageContent
                    web3={web3}
                    zeroEx={zeroEx}
                    b0x={b0x}
                    accounts={accounts}
                    tokens={tokens}
                  />
                </Fragment>
              )}
            />
          </Content>
        </Card>
      </Layout>
    );
  }
}
