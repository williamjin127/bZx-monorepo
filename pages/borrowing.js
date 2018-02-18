import Layout from "../src/common/Layout";
import { Card, Header, HeaderTitle, Content } from "../src/common/MainContent";
import { Divider } from "../src/common/FormSection";
import PageContent from "../src/borrowing";

export default class Trading extends React.Component {
  state = { activeTab: undefined };

  changeTab = tabId => this.setState({ activeTab: tabId });

  render() {
    const { activeTab } = this.state; // eslint-disable-line no-unused-vars
    return (
      <Layout>
        <Card>
          <Header>
            <HeaderTitle>Borrowing</HeaderTitle>
          </Header>
          <Content>
            This section will allow a trader (borrower) to manage active loans
            and view closed loans.
            <Divider />
            <PageContent />
          </Content>
        </Card>
      </Layout>
    );
  }
}
