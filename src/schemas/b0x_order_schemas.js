
exports.loanOrderSchema = {
  id: '/loanOrder',
  properties: {
    b0x: { $ref: '/Address' },
    maker: { $ref: '/Address' },
    loanTokenAddress: { $ref: '/Address' },
    interestTokenAddress: { $ref: '/Address' },
    collateralTokenAddress: { $ref: '/Address' },
    feeRecipientAddress: { $ref: '/Address' },
    oracleAddress: { $ref: '/Address' },
    loanTokenAmount: { $ref: '/Number' },
    interestAmount: { $ref: '/Number' },
    initialMarginAmount: { $ref: '/Number' },
    liquidationMarginAmount: { $ref: '/Number' },
    lenderRelayFee: { $ref: '/Number' },
    traderRelayFee: { $ref: '/Number' },
    expirationUnixTimestampSec: { $ref: '/Number' },
    salt: { $ref: '/Number' },
  },
  required: [
    'b0x', 'maker', 'loanTokenAddress', 'interestTokenAddress', 'collateralTokenAddress', 'feeRecipientAddress', 'oracleAddress',
    'loanTokenAmount', 'interestAmount', 'initialMarginAmount', 'liquidationMarginAmount',
    'lenderRelayFee', 'traderRelayFee', 'expirationUnixTimestampSec', 'salt',
  ],
  type: 'object',
};
exports.signedLoanOrderSchema = {
  id: '/signedLoanOrder',
  allOf: [
    { $ref: '/loanOrder' },
    {
      properties: {
        ecSignature: { $ref: '/ECSignature' },
      },
      required: ['ecSignature'],
    },
  ],
};
