import Section, { SectionLabel } from "../common/FormSection";
import LoanItem from "./LoanItem";

const openLoans = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

export default () => (
  <div>
    <Section>
      <SectionLabel>Unsafe Loans</SectionLabel>
      {openLoans.map(x => <LoanItem key={x.id} />)}
    </Section>
  </div>
);
