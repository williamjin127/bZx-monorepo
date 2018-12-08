# Setting up your project

Version 1.x of bzx.js compatible with Node.js 8.x on Windows and Linux platforms.

You can expect compatibility with Node.js 10.x soon.

### Install

Since version 1.x of this package, we stick with Semantic Versioning 2.0.0, so we recommend you to import bzx.js with a caret ^ in the version number to take advantage of non-breaking bug fixes.

Using NPM:

`npm install @bzxnetwork/bzx.js --save`

Using Yarn:

`yarn add @bzxnetwork/bzx.js`

### Initialize

```javascript
const Web3 = require("web3");
const { BZxJS } = require("@bzxnetwork/bzx.js");

const networkId = await web3.eth.net.getId();
const bzx = await new BZxJS(web3, { networkId });
```