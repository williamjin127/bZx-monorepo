import styled from "styled-components";
import Typography from "material-ui/Typography";
import Section, { SectionLabel } from "../../common/FormSection";

const Container = styled.div`
  width: 100%;
  text-align: left;
`;

export default () => (
  <Section>
    <SectionLabel>Add new tracked token</SectionLabel>
    <div>
      <p>
        TODO — show a token picker with list of tokens not currently tracked
      </p>
    </div>
  </Section>
);
