import styled from "styled-components";
import MuiDivider from "material-ui/Divider";

const Section = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
export default Section;

export const SectionLabel = styled.div`
  align-self: flex-start;
  color: rgba(0, 0, 0, 0.54);
  margin-bottom: 12px;
  font-size: 24px;
  font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  line-height: 1;
`;

export const Divider = styled(MuiDivider)`
  margin-top: 24px !important;
  margin-bottom: 24px !important;
`;
