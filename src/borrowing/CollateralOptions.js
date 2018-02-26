import { Fragment } from "react";
import Button from "material-ui/Button";
import Menu, { MenuItem } from "material-ui/Menu";

import ChangeCollateralDialog from "./ChangeCollateralDialog";
import DepositCollateralDialog from "./DepositCollateralDialog";
import WithdrawCollateralDialog from "./WithdrawCollateralDialog";

export default class CollateralOptions extends React.Component {
  state = {
    anchorEl: null,
    showChangeCollateralDialog: false,
    showDepositCollateralDialog: false,
    showWithdrawCollateralDialog: false
  };

  handleClick = event => {
    this.setState({ anchorEl: event.currentTarget });
  };

  handleClose = () => {
    this.setState({ anchorEl: null });
  };

  handleChangeCollateralClick = () => {
    this.handleClose();
    this.setState({ showChangeCollateralDialog: true });
  };

  handleDepositCollateralClick = () => {
    this.handleClose();
    this.setState({ showDepositCollateralDialog: true });
  };

  handleWithdrawCollateralClick = () => {
    this.handleClose();
    this.setState({ showWithdrawCollateralDialog: true });
  };

  closeDialog = stateProp => () => this.setState({ [stateProp]: false });

  render() {
    const { anchorEl } = this.state;

    return (
      <Fragment>
        <Button variant="raised" onClick={this.handleClick}>
          Collateral Options
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={this.handleClose}
        >
          <MenuItem onClick={this.handleChangeCollateralClick}>
            Change collateral token
          </MenuItem>
          <MenuItem onClick={this.handleDepositCollateralClick}>
            Deposit additional collateral
          </MenuItem>
          <MenuItem onClick={this.handleWithdrawCollateralClick}>
            Withdraw collateral
          </MenuItem>
        </Menu>
        <ChangeCollateralDialog
          open={this.state.showChangeCollateralDialog}
          onClose={this.closeDialog(`showChangeCollateralDialog`)}
        />
        <DepositCollateralDialog
          open={this.state.showDepositCollateralDialog}
          onClose={this.closeDialog(`showDepositCollateralDialog`)}
        />
        <WithdrawCollateralDialog
          open={this.state.showWithdrawCollateralDialog}
          onClose={this.closeDialog(`showWithdrawCollateralDialog`)}
        />
      </Fragment>
    );
  }
}
