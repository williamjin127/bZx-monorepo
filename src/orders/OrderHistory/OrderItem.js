import styled from "styled-components";
import MuiCard, { CardContent as MuiCardContent } from "material-ui/Card";
import { COLORS } from "../../styles/constants";

const CardContent = styled(MuiCardContent)`
  position: relative;
`;

const Card = styled(MuiCard)`
  width: 100%;
  margin-bottom: 24px;
`;

const Pre = styled.pre`
  overflow: auto;
  background: #ddd;
  padding: 12px;
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

const Hash = styled.span`
  font-family: monospace;
`;

export default class OrderItem extends React.Component {
  // state = { loanPositions: [] };

  async componentDidMount() {
    // const { b0x, accounts } = this.props;
    // const loanPositions = await b0x.getLoanPositions({
    //   loanPartyAddress: accounts[0].toLowerCase(),
    //   start: 0,
    //   count: 10
    // });
    // console.log(`loanPositions`, loanPositions);
    // this.setState({ loanPositions });
  }

  render() {
    const { order, accounts } = this.props;
    // const { loanPositions } = this.state;
    const isMaker = order.maker === accounts[0].toLowerCase();
    return (
      <Card>
        <CardContent>
          <DataPointContainer>
            <Label>Order #</Label>
            <DataPoint>
              <Hash>{order.loanOrderHash}</Hash>
            </DataPoint>
          </DataPointContainer>

          <DataPointContainer>
            <Label>Role</Label>
            <DataPoint>{isMaker ? `Maker` : `Lender`}</DataPoint>
          </DataPointContainer>
          <Pre>{JSON.stringify(order, null, 4)}</Pre>
          {/* <Pre>{JSON.stringify(loanPositions, null, 4)}</Pre> */}
        </CardContent>
      </Card>
    );
  }
}
