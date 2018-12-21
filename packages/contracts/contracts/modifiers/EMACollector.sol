/**
 * Copyright 2017–2018, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.2;

import "../openzeppelin-solidity/SafeMath.sol";


// supports a single EMA calculated for the inheriting contract
contract EMACollector {
    //using SafeMath for uint256;

    uint public emaValue; // the last ema calculated
    uint public emaPeriods; // averaging periods for EMA calculation

    uint public outlierMultiplier = 2;
    uint public outlierAdder = 5**9 wei; // 5 gwei

    //event EMAUpdated(uint newEMA);

    modifier updatesEMA(uint value) {
        _;

        updateEMA(value);
    }

    function updateEMA(uint value)
        internal {
        /*
            Multiplier: 2 / (emaPeriods + 1)
            EMA: (LastestValue - PreviousEMA) * Multiplier + PreviousEMA
        */

        require(emaPeriods >= 2, "emaPeriods < 2");

        // outliers are ignored
        if (value > emaValue && value >= SafeMath.add(SafeMath.mul(outlierMultiplier, emaValue), outlierAdder))
            return;

        // calculate new EMA
        emaValue =
            SafeMath.sub(
                SafeMath.add(
                    value / (emaPeriods + 1) * 2,   // no overflow
                    emaValue
                ),
                emaValue / (emaPeriods + 1) * 2     // no overflow
            );
        //emit EMAUpdated(emaValue);
    }
}
