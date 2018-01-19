require('babel-register');
require('babel-polyfill');

module.exports = {
  migrations_directory: "./migrations",
  rpc: {
    host: "localhost",
    port: 8545
  },
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "50"
      //gas: 4712388, // Default is 4712388
      //gasPrice: 0 // Default is 100000000000 (100 Shannon)
    },
    live: {
      network_id: 1,
      host: "localhost",
      port: 8546
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
/*module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
};*/
