import styled from "styled-components";
import MuiButton from "@material-ui/core/Button";
import OrderItem from "./OrderItem";
import BZxComponent from "../../common/BZxComponent";

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

export default class OrderHistory extends BZxComponent {
  state = { orders: [], loading: false, error: false, count: 10 };

  componentDidMount() {
    this.getOrdersForUser();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.tabId === `Orders_OrderHistory` &&
      this.props.tabId !== prevProps.tabId
    )
      this.getOrdersForUser();
  }

  getOrdersForUser = async () => {
    const { bZx, accounts } = this.props;
    this.setState({ loading: true });
    try {
      const orders = await this.wrapAndRun(bZx.getOrdersForUser({
        loanPartyAddress: accounts[0].toLowerCase(),
        start: 0,
        count: this.state.count
      }));
      console.log(orders);
      this.setState({ orders, loading: false, error: false });
    } catch(e) {
      console.log(e);
      this.setState({ error: true, loading: false, orders: [] });
    }
  };

  increaseCount = () => {
    this.setState(
      prev => ({
        count: prev.count + 10
      }),
      this.getOrdersForUser
    );
  };

  render() {
    const { bZx, accounts, tokens, changeTab } = this.props;
    const { orders, loading, error, count } = this.state;
    if (error) {
      return (
        <div>
          <InfoContainer>
            <ShowCount>Web3 error loading loan orders. Please refresh in a few minutes.</ShowCount>
            <Button onClick={this.getOrdersForUser} variant="raised" disabled={false}>
              Refresh
            </Button>
          </InfoContainer>
        </div>
      );
    } else if (orders.length === 0) {
      return (
        <div>
          <InfoContainer>
            <ShowCount>No loan orders found.</ShowCount>
            <Button
              onClick={this.getOrdersForUser}
              variant="raised"
              disabled={loading}
            >
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
            Showing last {count} orders ({orders.length} orders found).
          </ShowCount>
          <Button onClick={this.increaseCount} variant="raised" color="primary">
            Show more
          </Button>
          <Button
            onClick={this.getOrdersForUser}
            variant="raised"
            disabled={loading}
          >
            {loading ? `Refreshing...` : `Refresh`}
          </Button>
        </InfoContainer>
        <br />
        {orders.length > 0 ? (
          orders.map(takenOrder => {
            takenOrder.networkId = bZx.networkId; // eslint-disable-line no-param-reassign
            takenOrder.makerRole = // eslint-disable-line no-param-reassign
            takenOrder.collateralTokenAddress ===
              `0x0000000000000000000000000000000000000000`
                ? `0`
                : `1`;
            // console.log(bZx);
            // if (takenOrder.makerAddress !== accounts[0].toLowerCase())
            return (
              <OrderItem
                key={takenOrder.loanOrderHash}
                bZx={bZx}
                accounts={accounts}
                tokens={tokens}
                takenOrder={takenOrder}
                changeTab={changeTab}
              />
            );
          })
        ) : (
          <p>You have no orders, try refreshing.</p>
        )}
      </div>
    );
  }
}
