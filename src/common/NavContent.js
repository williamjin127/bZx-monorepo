import { Fragment } from "react";
import styled from "styled-components";
import { Logo, HorizontalNav } from "./NavComponents";

const HamburgerBtn = styled.div`
  padding: 12px;
  border: 1px solid blue;

  /* hide on desktop */
  @media screen and (min-width: 600px) {
    display: none;
  }
`;

const Overlay = styled.div`
  transition: background-color 200ms;
  background-color: rgba(0, 0, 0, ${p => (p.show ? `0.5` : `0`)});
  pointer-events: ${p => (p.show ? `unset` : `none`)};

  /* full screen */
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;

  /* hide on larger screens */
  @media screen and (min-width: 600px) {
    display: none;
  }
`;

const Drawer = styled.div`
  background: white;

  /* always show on mobile but can be tucked away;
    fixed width and add transition */
  display: block;
  width: 300px;
  transition: left 200ms ease-in-out;

  /* set it on the side */
  position: fixed;
  top: 0;
  bottom: 0;
  left: ${p => (p.show ? `0` : `-100%`)};

  /* hide on larger screens */
  @media screen and (min-width: 600px) {
    display: none;
  }
`;

class NavContent extends React.Component {
  state = { showSideNav: false };

  toggleSideNav = () => this.setState(p => ({ showSideNav: !p.showSideNav }));

  render() {
    return (
      <Fragment>
        <Logo>B0X</Logo>
        <HorizontalNav>
          <div>Link 1</div>
          <div>Link 2</div>
          <div>Link 3</div>
        </HorizontalNav>
        <HamburgerBtn onClick={this.toggleSideNav}>hamburger</HamburgerBtn>
        <Overlay show={this.state.showSideNav} onClick={this.toggleSideNav} />
        <Drawer show={this.state.showSideNav}>My sidenav items</Drawer>
      </Fragment>
    );
  }
}

export default NavContent;
