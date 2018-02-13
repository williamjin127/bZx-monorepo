import Section, { SectionLabel } from "../common/FormSection";
import OpenLoan from "./OpenLoan";
import ClosedLoan from "./ClosedLoan";

const openLoans = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

const closedLoans = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

export default () => (
  <div>
    <Section>
      <SectionLabel>Open Loans</SectionLabel>
      {openLoans.map(x => <OpenLoan key={x.id} />)}
    </Section>
    <Section>
      <SectionLabel>Closed Loans</SectionLabel>
      {closedLoans.map(x => <ClosedLoan key={x.id} />)}
    </Section>
  </div>
);

// This section will allow a trader (borrower) to manage active loans and view closed loans

// For active loans, the trader should see what loans they have open, and some details about them, such as:
//   - the lendOrderHash (from PART 1) tied to this loan
//   - the lender address (lender)
//   - the amount of margin token they put up as collateral (marginTokenAmountFilled)
//   - the amount of lend token they are borrowing for the loan (lendTokenAmountFilled)
//   - the amount of interest they've paid the lender so far for the loan (interestPaidSoFar)
//   - the date/time the loan started (filledUnixTimestampSec)

//   - if a 0x trade is not open from funds from the loan, provide something like this: https://0xproject.com/portal/fill
//     - a trader finds 0x trades from any source, and drops the 0x Order JSON here (note this is a 0x JSON from 0xProject and not to be confused with "LEND ORDER JSON" for b0x)
//     - the b0x portal reads the 0x JSON and submits the params to the b0x contract "open0xTrade" sol function:
//       function open0xTrade(
//         bytes32 lendOrderHash,
//         address[5] orderAddresses0x,
//         uint[6] orderValues0x,
//         uint8 v,
//         bytes32 r,
//         bytes32 s)
//         public
//         returns (uint);

//   - if an 0x trade has been opened using funds from the loan, show a few details about the loan:
//     - token that was traded and bought using the lend token (tradeTokenAddress)
//     - trade token amount (tradeTokenAmountFilled)
//     - should have "Close Trade" button - this calls into b0x to trigger a market order with Kyber to close this trade and buy back the lend token
//       sol function:
//         function closeTrade(
//           bytes32 lendOrderHash)
//           public
//           returns (bool tradeSuccess);

//     - optionally, we can provide a form like this https://0xproject.com/portal/fill again, to let the trader close the order with an "opposite" 0x order. this
//       passes the 0x order json params to b0x similar to above.
//       sol function:
//         function closeWith0xTrade(
//           bytes32 lendOrderHash,
//           address[5] orderAddresses0x,
//           uint[6] orderValues0x,
//           uint8 v,
//           bytes32 r,
//           bytes32 s)
//           public
//           returns (uint);

//   - provide a way to traders to change the current "marginToken of an active loan (via b0x contract function call TBD).
//   - provide a way to traders to "deposit" additional margin token to increase their margin level on active loans (via b0x contract function call TBD).
//   - provide a way for traders to withdraw margin token if and only if it's above "initialMarginAmount" (via b0x contract function call TBD).

// For closes loans, the above details should be provided as well, along with the closed date/time.
//   - trades can't be opened using a closed loan
//   - note: We don't allow margin "deposits" for closed loans.
//           Also, there is no need to provide a withdraw function for closed loans, since all margin is automatically refunded when the loan closes
